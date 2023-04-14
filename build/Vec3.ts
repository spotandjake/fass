export class Vec3 {
    quad!: Quadrant
    x!: f32
    y!: f32
    z!: f32
    @inline __FASS_SERIALIZE(output: ArrayBuffer): void {
        // Vec3 -> [1, 1.0, 2.0, 3.0]
        store<u8>(changetype<usize>(output), this.quad);
        store<f32>(changetype<usize>(output) + <usize>1, this.x);
        store<f32>(changetype<usize>(output) + <usize>2, this.y);
        store<f32>(changetype<usize>(output) + <usize>3, this.z);
    }
    @inline __FASS_DESERIALIZE(input: ArrayBuffer, output: Vec3): void {
        // [1, 1.0, 2.0, 3.0] -> Vec3
        this.quad = load<u8>(changetype<usize>(input));
        this.x = load<u8>(changetype<usize>(input) + <usize>1);
        this.x = load<u8>(changetype<usize>(input) + <usize>2);
        this.x = load<u8>(changetype<usize>(input) + <usize>3);
    }
    @inline __FASS_SIZE(): u32 {
        // 1 + 4 + 4 + 4 = 13 bytes long
        return 13;
    }
    @inline __FASS_SERIALIZE_KEY<T>(output: ArrayBuffer, readFromOffset: usize, writeToOffset: usize): void {
        store<T>(changetype<usize>(output), load<T>(changetype<usize>(output), readFromOffset), writeToOffset);
    }
}
 
enum Quadrant {
    TL = 1,
    TR = 2,  
    BL = 3,
    BR = 4
}

const bar: Vec3 = {
    quad: Quadrant.TL,
    x: 1.0,
    y: 2.0,
    z: 3.0
}