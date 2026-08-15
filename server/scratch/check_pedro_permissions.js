const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysqlPool = require('../services/mysqlService');

async function checkUserPermissions(nameFragment) {
    try {
        const [users] = await mysqlPool.query(
            "SELECT idUsuario, NomeCompleto, Login, TipoUsuario, Setor, Funcao, aprovado FROM usuario WHERE NomeCompleto LIKE ?",
            [`%${nameFragment}%`]
        );

        if (users.length === 0) {
            console.log('Nenhum usuario encontrado com esse nome.');
            return;
        }

        for (const u of users) {
            console.log(`\nUser: ${u.NomeCompleto} (Login: ${u.Login}, ID: ${u.idUsuario}, Tipo: ${u.TipoUsuario}, Setor: ${u.Setor}, Funcao: ${u.Funcao}, Aprovado: ${u.aprovado})`);

            const [perms] = await mysqlPool.query(
                'SELECT page_id, can_view, can_create, can_edit, can_delete FROM app_user_permissions WHERE user_id = ?',
                [u.idUsuario]
            );

            if (perms.length === 0) {
                console.log('  - Nenhuma permissao explicita em app_user_permissions.');
            } else {
                perms.forEach(p => {
                    const actions = [];
                    if (p.can_view) actions.push('VIEW');
                    if (p.can_create) actions.push('CREATE');
                    if (p.can_edit) actions.push('EDIT');
                    if (p.can_delete) actions.push('DELETE');
                    console.log(`  - ${p.page_id.padEnd(25)} [${actions.join(', ')}]`);
                });
            }

            const [companyRows] = await mysqlPool.query('SELECT general_config FROM app_company_settings LIMIT 1');
            if (companyRows.length > 0) {
                let gc = companyRows[0].general_config;
                if (typeof gc === 'string') gc = JSON.parse(gc);
                const profile = gc?.custom_profiles?.find(p => p.code === u.TipoUsuario);
                if (profile) {
                    console.log(`  - Perfil customizado: ${JSON.stringify(profile)}`);
                }
            }
        }
    } catch (err) {
        console.error('Erro:', err);
    } finally {
        process.exit(0);
    }
}

checkUserPermissions('Pedro Henrique Bernardo');
