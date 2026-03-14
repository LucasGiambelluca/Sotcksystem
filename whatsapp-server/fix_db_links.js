const { Client } = require('pg');
require('dotenv').config();

async function fixCatalogUrlInFlows() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        await client.connect();
        console.log('🔗 Conectado a la base de datos de producción...');

        // Verify if we have 'bot_flows' or 'flows'
        const botFlowsRes = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'bot_flows'
            );
        `);
        const flowsRes = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'flows'
            );
        `);

        if (botFlowsRes.rows[0].exists) {
            console.log('✅ Tabla bot_flows encontrada. Actualizando nodos...');
            const updateBotFlows = await client.query(`
                UPDATE bot_flows
                SET nodes = (
                    SELECT jsonb_agg(
                        CASE 
                            WHEN node->'data'->>'customMessage' LIKE '%/catalog%' THEN
                                jsonb_set(
                                    node,
                                    '{data,customMessage}',
                                    to_jsonb(replace(node->>'data'::text, '/catalog', '/elpollocomilon/catalog'))
                                )
                            ELSE node
                        END
                    )
                    FROM jsonb_array_elements(nodes) AS node
                )
                WHERE nodes::text LIKE '%/catalog%';
            `);
            console.log(`✅ ${updateBotFlows.rowCount} flujos actualizados en bot_flows.`);
        }

        if (flowsRes.rows[0].exists) {
            console.log('✅ Tabla flows encontrada. Actualizando nodos...');
            
            // First we fetch the flows to do it confidently in JS
            const { rows } = await client.query('SELECT id, nodes FROM flows');
            let updatedCount = 0;
            
            for (const row of rows) {
                if (!row.nodes || !Array.isArray(row.nodes)) continue;
                
                let changed = false;
                const newNodes = row.nodes.map(node => {
                    // El URL del catálog puede estar en data.customMessage o data.text, etc.
                    let nodeStr = JSON.stringify(node);
                    if (nodeStr.includes('stocksystemspp.com/catalog') || nodeStr.includes('stock-system-catalog.app/catalog')) {
                        nodeStr = nodeStr.replace(/stocksystemspp\.com\/catalog/g, 'stocksystemspp.com/elpollocomilon/catalog');
                        nodeStr = nodeStr.replace(/stock-system-catalog\.app\/catalog/g, 'stocksystemspp.com/elpollocomilon/catalog');
                        nodeStr = nodeStr.replace(/stocksystemapp\.com\/catalog/g, 'stocksystemspp.com/elpollocomilon/catalog');
                        changed = true;
                        return JSON.parse(nodeStr);
                    }
                    return node;
                });
                
                if (changed) {
                    await client.query('UPDATE flows SET nodes = $1 WHERE id = $2', [JSON.stringify(newNodes), row.id]);
                    updatedCount++;
                }
            }
            console.log(`✅ ${updatedCount} flujos actualizados en flows.`);
        }

        console.log('🎉 ¡Todas las URLs del catálogo arregladas en la base de datos!');

    } catch (error) {
        console.error('❌ Error al actualizar los flujos:', error);
    } finally {
        await client.end();
    }
}

fixCatalogUrlInFlows();
