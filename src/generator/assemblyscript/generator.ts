import { EnumDeclaration, IncludeDeclaration, StructDeclaration } from "../../parser/nodes";
import { Source } from "../../parser/source";

enum Offsets {
    u8 = 1,
    i8 = 1,
    bool = 1,
    u16 = 2,
    i16 = 2,
    u32 = 4, 
    i32 = 4,
    f32 = 4,
    u64 = 8,
    i64 = 8,
    f64 = 8
}

class GeneratorOptions {
    simd: boolean = false;
}

export class Generator {
    public text: string = "";
    public source!: Source;
    constructor(source: Source, options?: GeneratorOptions) {
        this.source = source;
    }
    generate(): string {
        for (const decl of this.source.stmts) {
            if (decl instanceof StructDeclaration) {
                this.text += "\n\n" + this.generateStaticStruct(decl);
            } else if (decl instanceof EnumDeclaration) {
                this.text += "\n\n" + this.generateEnum(decl);
            } else if (decl instanceof IncludeDeclaration) {
                this.text += "\n\n" + this.generateIncludeDecl(decl);
            }
        }
        // Slice of first "/n/n"
        return this.text.slice(2);
    }
    generateIncludeDecl(decl: IncludeDeclaration): string {
        const imports: string[] = [];
        for (const stmt of decl.included) {
            const name = getNameOfDecl(stmt);
            if (name) imports.push(name);
        }
        return `import { ${imports.join(", ")} } from "./${decl.predicate.slice(1).replace(".fass", "")};`
    }
    generateStaticStruct(decl: StructDeclaration): string {
        let txt = `export class ${decl.name.value} {`;

        for (const { name: { value }, type: { text } } of decl.members) {
            let type = text;
            const key = value;
            if (type.endsWith("]") && type.indexOf("[") > 0) {
                if (type.startsWith("char")) {
                    type = "string";
                } else {
                    type = `StaticArray<${type.slice(0, type.indexOf("["))}>`
                }   
            }
            txt += `\n    ${key}!: ${type};`;
            //                  ^ Because intellisense hates us
        }
        
        let serialize = [`@inline __FASS_SERIALIZE(output: ArrayBuffer, input: ${decl.name.value}): void {`];
        let deserialize = [`@inline __FASS_DESERIALIZE(input: ArrayBuffer, output: ${decl.name.value}): void {`];
        // DETECT STATIC STRUCT
        let size = `public __FASS_SIZE: u32 = `;

        let offset = 0;
        
        // STAGE: Import and cache
        let members = decl.members;

        for (let i = 0; i < decl.members.length; i++) {
            const member = members[i];
            const namedType = member.type.text;
            const declaredName = member.name.value;
            const scopeElement = this.source.scope.getElement(undefined, member.type.text);
            // If not in scope, must be primitive.
            if (!scopeElement) {
                if (namedType === "bool") {
                    serialize.push(`store<bool>(changetype<usize>(output), input.${declaredName}, ${offset});`);
                    deserialize.push(`output.${declaredName} = load<bool>(changetype<usize>(input), ${offset});`);
                    offset += 1;
                } else if (namedType === "u8" || namedType == "char") {
                    serialize.push(`store<u8>(changetype<usize>(output), input.${declaredName}, ${offset});`);
                    deserialize.push(`output.${declaredName} = load<u8>(changetype<usize>(input), ${offset});`);
                    offset += 1;
                } else if (namedType === "i8") {
                    serialize.push(`store<i8>(changetype<usize>(output), input.${declaredName}, ${offset});`);
                    deserialize.push(`output.${declaredName} = load<i8>(changetype<usize>(input), ${offset});`);
                    offset += 1;
                } else if (namedType === "u16") {
                    serialize.push(`store<u16>(changetype<usize>(output), input.${declaredName}, ${offset});`);
                    deserialize.push(`output.${declaredName} = load<u16>(changetype<usize>(input), ${offset});`);
                    offset += 2;
                } else if (namedType === "i16") {
                    serialize.push(`store<i16>(changetype<usize>(output), input.${declaredName}, ${offset});`);
                    deserialize.push(`output.${declaredName} = load<i16>(changetype<usize>(input), ${offset});`);
                    offset += 2;
                } else if (namedType === "u32") {
                    serialize.push(`store<u32>(changetype<usize>(output), input.${declaredName}, ${offset});`);
                    deserialize.push(`output.${declaredName} = load<u32>(changetype<usize>(input), ${offset});`);
                    offset += 4;
                } else if (namedType === "i32") {
                    serialize.push(`store<i32>(changetype<usize>(output), input.${declaredName}, ${offset});`);
                    deserialize.push(`output.${declaredName} = load<i32>(changetype<usize>(input), ${offset});`);
                    offset += 4;
                } else if (namedType === "u64") {
                    serialize.push(`store<u64>(changetype<usize>(output), input.${declaredName}, ${offset});`);
                    deserialize.push(`output.${declaredName} = load<u64>(changetype<usize>(input), ${offset});`);
                    offset += 8;
                } else if (namedType === "i64") {
                    serialize.push(`store<i64>(changetype<usize>(output), input.${declaredName}, ${offset});`);
                    deserialize.push(`output.${declaredName} = load<i64>(changetype<usize>(input), ${offset});`);
                    offset += 8;
                }
                // FLOAT                
                else if (namedType === "f32") {
                    serialize.push(`store<f32>(changetype<usize>(output), input.${declaredName}, ${offset});`);
                    deserialize.push(`output.${declaredName} = load<f32>(changetype<usize>(input), ${offset});`);
                    offset += 4;
                } else if (namedType === "f64") {
                    serialize.push(`store<f64>(changetype<usize>(output), input.${declaredName}, ${offset});`);
                    deserialize.push(`output.${declaredName} = load<f64>(changetype<usize>(input), ${offset});`);
                    offset += 8;
                }

                if (namedType.endsWith("]")) {
                    // We have either a static or dynamic sequence.
                    const baseType = namedType.slice(0, namedType.indexOf("["));
                    const innerExpression = namedType.slice(namedType.indexOf("[") + 1, namedType.length - 1);

                    const isStatic = innerExpression.length ? true : false;

                    if (isStatic) {
                        // We have a set-length string
                        if (baseType == "char") {
                            let length = parseInt(innerExpression);
                            offset += length;
                            serialize.push(`String.UTF8.encodeUnsafe(changetype<usize>(input.${declaredName}), ${length}, changetype<usize>(output));`);
                            deserialize.push(`output.${declaredName} = String.UTF8.decodeUnsafe(changetype<usize>(input), ${length});`)
                        }
                    }
                }
            } else {
                // Here we have actual structures
                if (scopeElement.node instanceof EnumDeclaration && scopeElement.name == namedType) {
                    serialize.push(`store<u8>(changetype<usize>(output), input.${declaredName}, ${offset});`);
                    deserialize.push(`output.${declaredName} = load<u8>(changetype<usize>(input), ${offset});`);
                    offset += 1;
                } else if (scopeElement.node instanceof StructDeclaration && scopeElement.name == namedType) {
                    
                }
            }
        }
        
        txt += "\n    " + (size += offset + ";");

        txt += "\n    " + serialize[0];
        for (let i = 1; i < serialize.length; i++) {
            const serializeText = serialize[i];
            txt += "\n        " + serializeText;
        }
        txt += "\n    }";

        txt += "\n    " + deserialize[0];
        for (let i = 1; i < serialize.length; i++) {
            const deserializeText = deserialize[i];
            txt += "\n        " + deserializeText;
        }
        txt += "\n    }";

        txt += "\n}";

        return txt;
    }
    generateEnum(decl: EnumDeclaration): string {
        let txt = `export enum ${decl.name.value} {`;
        for (const member of decl.members) {
            txt += `\n    ${member.name.value}${member.value ? ` = ${member.value.value}` : ""},`;
        }
        if (txt.endsWith(",")) txt = txt.slice(0, txt.length - 1);
        txt += "\n}";
        return txt;
    }
}

function getNameOfDecl<T>(decl: T): string | null {
    if (decl instanceof StructDeclaration) {
        return decl.name.value;
    } else if (decl instanceof EnumDeclaration) {
        return decl.name.value;
    }
    return null;
}