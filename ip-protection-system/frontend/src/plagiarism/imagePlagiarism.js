// Generate 64-bit difference hash (dHash)
export function generateImageHash(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";

        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = 9;
            canvas.height = 8;

            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, 9, 8);

            const pixels = ctx.getImageData(0, 0, 9, 8).data;
            let bits = "";

            for (let y = 0; y < 8; y++) {
                for (let x = 0; x < 8; x++) {
                    const i = (y * 9 + x) * 4;
                    const j = (y * 9 + x + 1) * 4;

                    const left = pixels[i] + pixels[i + 1] + pixels[i + 2];
                    const right = pixels[j] + pixels[j + 1] + pixels[j + 2];

                    bits += left > right ? "1" : "0";
                }
            }

            resolve(bits); // 64-bit binary string
        };

        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
}

export function hammingDistance(hashA, hashB) {
    let distance = 0;
    for (let i = 0; i < hashA.length; i++) {
        if (hashA[i] !== hashB[i]) distance++;
    }
    return distance;
}
