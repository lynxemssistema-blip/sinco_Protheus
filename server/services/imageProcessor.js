/**
 * imageProcessor.js
 * Converte imagem para bitmap monocromático 1-bit (Preto/Branco puro)
 * e gera o comando GW (Direct Graphic Write) do protocolo PPLB/EPL2.
 *
 * Especificação técnica (Argox OS-214 Plus / EPL2):
 *   - Resolução: 203 DPI (8 dots/mm)
 *   - Área útil: 600 x 440 dots (75mm x 55mm)
 *   - Logo: máx 200 dots largura, máx 120 dots altura
 *   - Bytes por linha = ceil(largura / 8), preenchido à direita com 0
 */

const sharp = require('sharp');

const MAX_LOGO_WIDTH_DOTS  = 200;
const MAX_LOGO_HEIGHT_DOTS = 120;
const THRESHOLD = 128; // Limiar de conversão para P/B

/**
 * Processa uma imagem e retorna o comando GW para uso no motor PPLB.
 * @param {Buffer} imageBuffer - Buffer da imagem (JPG, PNG, etc.)
 * @param {number} [xPos=10]   - Posição X na etiqueta (dots)
 * @param {number} [yPos=10]   - Posição Y na etiqueta (dots)
 * @returns {Promise<{gwCommand: string, widthDots: number, heightDots: number, base64Preview: string}>}
 */
async function processImageToGW(imageBuffer, xPos = 10, yPos = 10) {
    // 1. Redimensionar mantendo proporção, limitado ao máx de dots da área útil
    const resized = await sharp(imageBuffer)
        .resize(MAX_LOGO_WIDTH_DOTS, MAX_LOGO_HEIGHT_DOTS, {
            fit: 'inside',
            withoutEnlargement: true,
        })
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .greyscale()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const { data: pixels, info } = resized;
    const { width, height } = info;

    // 2. Calcular bytes por linha (deve ser múltiplo de 8 bits → byte completo)
    const bytesPerRow = Math.ceil(width / 8);
    const rowBits = bytesPerRow * 8;

    // 3. Converter pixels em bitmap 1-bit
    // Na PPLB: bit 1 = PRETO (imprime), bit 0 = BRANCO (não imprime)
    const bitmapBytes = [];

    for (let y = 0; y < height; y++) {
        for (let byteIdx = 0; byteIdx < bytesPerRow; byteIdx++) {
            let byte = 0;
            for (let bit = 0; bit < 8; bit++) {
                const xPixel = byteIdx * 8 + bit;
                if (xPixel < width) {
                    const pixelValue = pixels[y * width + xPixel];
                    // Preto = abaixo do threshold → bit 1
                    if (pixelValue < THRESHOLD) {
                        byte |= (0x80 >> bit);
                    }
                }
                // Se xPixel >= width → bit 0 (padding branco)
            }
            bitmapBytes.push(byte);
        }
    }

    // 4. Converter para string hex (cada byte como 2 hex chars)
    const hexString = Buffer.from(bitmapBytes).toString('hex').toUpperCase();

    // 5. Construir o comando GW
    // Sintaxe: GW<x>,<y>,<bytesPerRow>,<height>,<bytes_hex_raw>
    // Os bytes são enviados como binário, não como hex string no protocolo real,
    // mas nós vamos serializar como Buffer para o envio RAW.
    const gwCommand = buildGWCommand(xPos, yPos, bytesPerRow, height, Buffer.from(bitmapBytes));

    // 6. Gerar preview base64 (PNG P/B para o frontend)
    const previewBuffer = await sharp(Buffer.from(
        expandBitmapToRaw(bitmapBytes, bytesPerRow, width, height)
    ), {
        raw: { width, height, channels: 1 }
    })
        .png()
        .toBuffer();

    return {
        gwCommand,
        widthDots: width,
        heightDots: height,
        bytesPerRow,
        bitmapBytes,
        base64Preview: previewBuffer.toString('base64'),
    };
}

/**
 * Constrói o comando GW com bytes binários.
 * Na PPLB, o GW é seguido imediatamente pelos bytes binários da imagem.
 * Formato: "GW<x>,<y>,<bytesPerRow>,<height>\n" + <binary bytes>
 */
function buildGWCommand(x, y, bytesPerRow, height, bitmapBuffer) {
    const header = `GW${x},${y},${bytesPerRow},${height}\n`;
    return { header, bitmapBuffer };
}

/**
 * Expande o bitmap de volta para raw pixels (para gerar preview PNG).
 */
function expandBitmapToRaw(bitmapBytes, bytesPerRow, width, height) {
    const raw = Buffer.alloc(width * height, 255); // branco
    for (let y = 0; y < height; y++) {
        for (let byteIdx = 0; byteIdx < bytesPerRow; byteIdx++) {
            const byte = bitmapBytes[y * bytesPerRow + byteIdx];
            for (let bit = 0; bit < 8; bit++) {
                const x = byteIdx * 8 + bit;
                if (x < width) {
                    const isBlack = (byte & (0x80 >> bit)) !== 0;
                    raw[y * width + x] = isBlack ? 0 : 255;
                }
            }
        }
    }
    return raw;
}

/**
 * Processa a imagem completa do Canvas (600x440) gerado pelo Frontend
 * convertendo para a matriz P/B de 1-bit completa.
 * @param {string} base64String 
 */
async function processCanvasToGW(base64String, threshold = 128) {
    const buffer = Buffer.from(base64String.replace(/^data:image\/\w+;base64,/, ""), 'base64');
    
    // Processa garantindo o tamanho 600x440 e fundo branco
    const resized = await sharp(buffer)
        .resize(600, 440, { fit: 'fill' }) // Força o preenchimento exato da área de renderização
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .greyscale()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const { data: pixels, info } = resized;
    const { width, height } = info;
    const bytesPerRow = Math.ceil(width / 8);
    const bitmapBytes = [];

    for (let y = 0; y < height; y++) {
        for (let byteIdx = 0; byteIdx < bytesPerRow; byteIdx++) {
            let byte = 0;
            for (let bit = 0; bit < 8; bit++) {
                const xPixel = byteIdx * 8 + bit;
                if (xPixel < width) {
                    const pixelValue = pixels[y * width + xPixel];
                    if (pixelValue < threshold) {
                        byte |= (0x80 >> bit);
                    }
                }
            }
            bitmapBytes.push(byte);
        }
    }

    const bitmapBuffer = Buffer.from(bitmapBytes);
    // Posição sempre X=0, Y=0 para cobrir tudo
    const gwCommand = buildGWCommand(0, 0, bytesPerRow, height, bitmapBuffer);

    return {
        gwCommand,
        widthDots: width,
        heightDots: height,
        bytesPerRow,
        bitmapBytes
    };
}

module.exports = { processImageToGW, buildGWCommand, processCanvasToGW };
