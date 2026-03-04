const axios = require('axios');

/**
 * Serviço de ponte para comunicação com o SolidEdge Agent local
 */
class SincoAgentBridge {
    constructor() {
        // O Agent roda na máquina local do usuário que está com o SolidEdge aberto
        this.basePorts = [8080, 8081, 8082];
        this.activePort = null; // Cache do porto encontrado
        this.timeout = 5000; // 5 segundos
    }

    /**
     * Encontra em qual porta o agent está rodando (8080, 8081, 8082)
     */
    async discoverAgent(baseUrl) {
        // Se já temos um porto ativo que funcionou recentemente, tenta ele primeiro
        if (this.activePort) {
            return this.activePort;
        }

        console.log(`🔍 [AgentBridge] Procurando Agent em ${baseUrl} nas portas ${this.basePorts.join(',')}...`);

        // Tenta todas as portas em paralelo
        const promises = this.basePorts.map(async (port) => {
            try {
                const url = `${baseUrl}:${port}/api/solidedge/status`;
                await axios.get(url, { timeout: 2000 });
                return port;
            } catch (err) {
                return null;
            }
        });

        const results = await Promise.all(promises);
        const foundPort = results.find(p => p !== null);

        if (foundPort) {
            console.log(`✅ [AgentBridge] Agent encontrado na porta ${foundPort}!`);
            this.activePort = foundPort;
            return foundPort;
        }

        console.log('❌ [AgentBridge] Agent não encontrado em nenhuma porta.');
        return null;
    }

    /**
     * Resolve a URL do agent baseada no IP do cliente
     */
    async getAgentBaseUrl(clientIp) {
        let baseUrl = 'http://localhost';

        // Se IP não for localhost, usa o IP
        if (clientIp && clientIp !== '::1' && clientIp !== '127.0.0.1' && clientIp !== 'localhost' && clientIp !== '::ffff:127.0.0.1') {
            // Remove prefixo IPv6 se houver
            const cleanIp = clientIp.replace('::ffff:', '');
            baseUrl = `http://${cleanIp}`;
        }

        const port = await this.discoverAgent(baseUrl) || 8080; // Default 8080 se não achar
        return `${baseUrl}:${port}`;
    }

    /**
     * Verifica se o agent está rodando
     */
    async checkAgentStatus(clientIp = 'localhost') {
        const url = await this.getAgentBaseUrl(clientIp);
        try {
            console.log(`📡 [AgentBridge] Verificando status em: ${url}/api/solidedge/status`);
            const response = await axios.get(`${url}/api/solidedge/status`, {
                timeout: 3000
            });
            return response.data;
        } catch (error) {
            // Se falhar, reseta o porto ativo para forçar nova busca na próxima
            this.activePort = null;

            if (error.code === 'ECONNREFUSED' || error.code === 'ECONNABORTED') {
                return {
                    isRunning: false,
                    error: 'Agent local não detectado (verifique se está rodando).'
                };
            }
            return { isRunning: false, error: error.message };
        }
    }

    /**
     * Obtém dados do documento ativo
     */
    async getActiveDocument(clientIp = 'localhost') {
        const url = await this.getAgentBaseUrl(clientIp);
        try {
            console.log(`📡 [AgentBridge] Buscando doc ativo em: ${url}/api/solidedge/active-document`);
            const response = await axios.get(`${url}/api/solidedge/active-document`, {
                timeout: this.timeout
            });
            return response.data;
        } catch (error) {
            if (error.response && error.response.status === 404) {
                return {
                    error: 'Nenhum documento aberto no SolidEdge'
                };
            }
            console.error('❌ Erro ao buscar documento ativo do Agent:', error.message);
            return {
                error: 'SolidEdge Agent inacessível ou erro interno',
                details: error.message,
                url: `${url}/api/solidedge/active-document`
            };
        }
    }

    /**
     * Exporta DXF do documento ativo
     */
    async exportDxf(outputPath = null) {
        try {
            // Assume localhost for export actions usually initiated from local interaction
            const url = await this.getAgentBaseUrl('localhost');
            const response = await axios.post(
                `${url}/api/solidedge/export-dxf`,
                { outputPath },
                { timeout: 45000 } // 45 segundos para exportação
            );
            return response.data;
        } catch (error) {
            if (error.response) {
                return {
                    success: false,
                    error: error.response.data.message || error.response.data.error
                };
            }
            throw error;
        }
    }

    /**
     * Exporta PDF do detalhamento
     */
    async exportPdf(outputPath = null) {
        try {
            // Assume localhost for export actions
            const url = await this.getAgentBaseUrl('localhost');
            const response = await axios.post(
                `${url}/api/solidedge/export-pdf`,
                { outputPath },
                { timeout: 45000 } // 45 segundos para exportação
            );
            return response.data;
        } catch (error) {
            if (error.response) {
                return {
                    success: false,
                    error: error.response.data.message || error.response.data.error
                };
            }
            throw error;
        }
    }
}

module.exports = new SincoAgentBridge();
