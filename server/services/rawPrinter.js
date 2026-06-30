/**
 * rawPrinter.js
 * Módulo de comunicação RAW com a impressora.
 * Suporta dois modos:
 *   - USB  : Envia via TCP para 127.0.0.1:9100 (servidor de impressão RAW local)
 *   - TCP  : Envia via TCP direto para o IP de rede da impressora (porta 9100 padrão)
 *
 * Todas as impressoras industriais (Argox, Zebra, Elgin, etc.) expõem a porta 9100
 * para impressão RAW direta, eliminando a necessidade de drivers gráficos.
 */

const net = require('net');

const DEFAULT_PORT    = 9100;
const CONNECT_TIMEOUT = 8000;  // ms para estabelecer conexão
const SEND_TIMEOUT    = 30000; // ms para envio completo

/**
 * Envia um buffer PPLB RAW para a impressora via TCP.
 *
 * @param {string} host        - IP da impressora (ex: '192.168.1.100') ou '127.0.0.1' para USB local
 * @param {number} port        - Porta TCP (padrão 9100)
 * @param {Buffer} labelBuffer - Buffer de bytes PPLB montado pelo pplbEngine
 * @returns {Promise<void>}
 */
function sendRaw(host, port = DEFAULT_PORT, labelBuffer) {
    return new Promise((resolve, reject) => {
        const socket = new net.Socket();
        let settled = false;

        const done = (err) => {
            if (settled) return;
            settled = true;
            socket.destroy();
            if (err) reject(err);
            else resolve();
        };

        const connectTimeout = setTimeout(() => {
            done(new Error(`Timeout ao conectar em ${host}:${port} (${CONNECT_TIMEOUT}ms)`));
        }, CONNECT_TIMEOUT);

        socket.connect(port, host, () => {
            clearTimeout(connectTimeout);

            const sendTimeout = setTimeout(() => {
                done(new Error(`Timeout ao enviar dados para ${host}:${port} (${SEND_TIMEOUT}ms)`));
            }, SEND_TIMEOUT);

            socket.write(labelBuffer, (err) => {
                clearTimeout(sendTimeout);
                if (err) {
                    done(new Error(`Erro ao escrever dados: ${err.message}`));
                    return;
                }

                // Aguarda a impressora confirmar recebimento (fim de stream)
                // Algumas impressoras não respondem — forçamos drain + close após breve delay
                socket.end();
                setTimeout(() => done(), 500);
            });
        });

        socket.on('error', (err) => {
            clearTimeout(connectTimeout);
            done(new Error(`Erro de socket em ${host}:${port} — ${err.message}`));
        });

        socket.on('close', () => done());
    });
}

/**
 * Testa a conectividade com a impressora (verifica se a porta está aberta).
 * Não envia dados de impressão.
 *
 * @param {string} host
 * @param {number} port
 * @returns {Promise<{ok: boolean, latencyMs: number, error?: string}>}
 */
function testConnection(host, port = DEFAULT_PORT) {
    return new Promise((resolve) => {
        const start = Date.now();
        const socket = new net.Socket();

        const fail = (msg) => {
            socket.destroy();
            resolve({ ok: false, latencyMs: Date.now() - start, error: msg });
        };

        const timeout = setTimeout(() => {
            fail(`Timeout: ${host}:${port} não respondeu em ${CONNECT_TIMEOUT}ms`);
        }, CONNECT_TIMEOUT);

        socket.connect(port, host, () => {
            clearTimeout(timeout);
            const latencyMs = Date.now() - start;
            socket.destroy();
            resolve({ ok: true, latencyMs });
        });

        socket.on('error', (err) => {
            clearTimeout(timeout);
            fail(`${err.message}`);
        });
    });
}

module.exports = { sendRaw, testConnection, DEFAULT_PORT };
