// ═══════════════════════════════════════════════════════════════
//  AutomationX Gallery Server + Local RAG Pipeline
//  LangChain v1.x · Ollama · HNSWLib (persistent)
// ═══════════════════════════════════════════════════════════════

const { getVectorStore } = require('./knowledgebase');
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = 3000;

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════
const CONFIG = {
    ollamaBaseUrl:     'http://localhost:11434',
    llmModel:          'llama3',
    embeddingModel:    'nomic-embed-text',
    dataFile:          './data/avalant_media.txt',
    ragTimeoutMs:      15000,
    forwardWebhookUrl: null,
};
// ═══════════════════════════════════════════════════════════════

let ragChain  = null;
let ragReady  = false;
let ragError  = null;

const FALLBACK_KNOWLEDGE = {
    location:
        'Avalant ตั้งอยู่ที่ 20 อาคารบุปผจิต ชั้น 15 ถนนสาทรเหนือ แขวงสีลม เขตบางรัก กรุงเทพมหานคร 10500 ค่ะ',
    about:
        'Avalant Co., Ltd. เป็นบริษัทเทคโนโลยีไทยที่ให้บริการ Digital Platform ระดับองค์กร มีความเชี่ยวชาญด้าน Software, AI, Low-Code และโซลูชันองค์กร โดยก่อตั้งในปี พ.ศ. 2545',
    products:
        'ข้อมูลเด่นของ Avalant ได้แก่ ONEWEB แพลตฟอร์ม Low-Code, Promptx สำหรับช่วยสร้างต้นแบบแอปและเอกสารด้วย AI รวมถึงโซลูชัน IBM Automation, Integration และ Data & AI',
};

// ───────────────────────────────────────────────
// FALLBACK (ใช้เมื่อ RAG ไม่พร้อม)
// ───────────────────────────────────────────────
function getFallbackAnswer(message) {
    const text    = message.toLowerCase();
    const compact = text.replace(/\s+/g, '');

    if (!compact.includes('avalant') && !compact.includes('อวาลันท์') && !compact.includes('อวาแลนท์')) {
        return null;
    }
    if (compact.includes('อยู่ที่ไหน') || compact.includes('ที่อยู่') || compact.includes('location') || compact.includes('address')) {
        return FALLBACK_KNOWLEDGE.location;
    }
    if (compact.includes('คือ') || compact.includes('เกี่ยวกับ') || compact.includes('about') || compact.includes('บริษัท')) {
        return FALLBACK_KNOWLEDGE.about;
    }
    if (compact.includes('ai') || compact.includes('promptx') || compact.includes('oneweb') || compact.includes('product') || compact.includes('solution')) {
        return FALLBACK_KNOWLEDGE.products;
    }
    return `${FALLBACK_KNOWLEDGE.about}\n\n${FALLBACK_KNOWLEDGE.location}`;
}

// ───────────────────────────────────────────────
// INIT RAG (เวอร์ชันเดียว ใช้ knowledgebase.js)
// ───────────────────────────────────────────────
async function initRAG() {
    try {
        console.log('🔧 Initializing RAG pipeline...');

        const { Ollama }             = await import('@langchain/ollama');
        const { ChatPromptTemplate } = await import('@langchain/core/prompts');

        // โหลด vector store จาก disk (หรือสร้างใหม่อัตโนมัติถ้ายังไม่มี)
        const vectorStore = await getVectorStore(CONFIG.ollamaBaseUrl, CONFIG.embeddingModel);
        const retriever   = vectorStore.asRetriever({ k: 4 });
        console.log('🗄️  Vector store ready');

        const llm = new Ollama({
            model:       CONFIG.llmModel,
            baseUrl:     CONFIG.ollamaBaseUrl,
            temperature: 0.3,
        });

        const prompt = ChatPromptTemplate.fromTemplate(`คุณเป็นผู้ช่วย AI ของบริษัท Avalant ตอบคำถามโดยใช้ข้อมูลที่ให้มาเท่านั้น
ถ้าไม่มีข้อมูลในบริบท ให้ตอบว่า "ขออภัย ไม่มีข้อมูลในส่วนนี้ค่ะ"
ตอบเป็นภาษาไทยเสมอ กระชับ และชัดเจน

บริบท:
{context}

คำถาม: {input}

คำตอบ:`);

        ragChain  = { retriever, llm, prompt };
        ragReady  = true;
        console.log('✅ RAG pipeline ready!\n');

    } catch (err) {
        ragError = err.message;
        console.error('❌ RAG init failed:', err.message);
        console.warn('⚠️  Running in fallback mode\n');
    }
}

// ───────────────────────────────────────────────
// QUERY RAG
// ───────────────────────────────────────────────
async function queryRAG(question) {
    if (!ragReady || !ragChain) return null;
    try {
        const result = await Promise.race([
            (async () => {
                const docs    = await ragChain.retriever.invoke(question);
                const context = docs.map(d => d.pageContent).join('\n\n---\n\n');
                const messages = await ragChain.prompt.formatMessages({ context, input: question });
                const response = await ragChain.llm.invoke(messages);
                return typeof response === 'string' ? response : response.content;
            })(),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('RAG timeout')), CONFIG.ragTimeoutMs)
            ),
        ]);
        return result?.trim() || null;
    } catch (err) {
        console.error('RAG query error:', err.message);
        return null;
    }
}

// ───────────────────────────────────────────────
// HTTP SERVER
// ───────────────────────────────────────────────
const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

    // GET /status
    if (req.url === '/status' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
            rag:   ragReady ? 'ready' : (ragError ? 'error' : 'loading'),
            error: ragError || null,
            model: CONFIG.llmModel,
        }, null, 2));
        return;
    }

    // POST /chat
    if (req.url === '/chat' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const data    = JSON.parse(body);
                const message = data.message?.trim() || '';
                const msgLow  = message.toLowerCase();
                console.log('💬 Message:', message);

                let responseText = '';

                // 1. ถาม RAG ก่อน
                if (ragReady) {
                    const ragAnswer = await queryRAG(message);
                    if (ragAnswer && !ragAnswer.includes('ไม่มีข้อมูล')) {
                        responseText = ragAnswer;
                        console.log('🤖 RAG answered');
                    }
                }

                // 2. Fallback ข้อมูล Avalant พื้นฐาน
                if (!responseText) {
                    responseText = getFallbackAnswer(message) || '';
                }

                // 3. เช็คชื่อรูปภาพ
                if (!responseText) {
                    const imagesDir  = path.join(__dirname, 'images');
                    const extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
                    let   found      = false;
                    for (const ext of extensions) {
                        if (fs.existsSync(path.join(imagesDir, msgLow + ext))) {
                            found = true; break;
                        }
                    }
                    responseText = found
                        ? `✅ เพิ่มรูป "${msgLow}" ลงแกลเลอรีแล้ว!`
                        : 'ขออภัย ไม่มีข้อมูลในส่วนนี้ค่ะ';
                }

                res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end(responseText);

            } catch (err) {
                console.error('Chat error:', err);
                res.writeHead(500); res.end('❌ Server error');
            }
        });
        return;
    }

    // Static Files
    let reqPath    = req.url === '/' ? 'image-gallery.html' : req.url;
    reqPath        = reqPath.split('?')[0].replace(/^\/+/, '');
    const filePath = path.join(__dirname, reqPath);

    fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end('404 Not Found'); return; }
        const mimeTypes = {
            '.html': 'text/html; charset=utf-8', '.css': 'text/css',
            '.js':   'application/javascript',   '.json': 'application/json',
            '.jpg':  'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
            '.gif':  'image/gif',  '.webp': 'image/webp', '.svg': 'image/svg+xml',
            '.mp4':  'video/mp4',
        };
        const ct = mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': ct });
        res.end(data);
    });
});

server.listen(PORT, async () => {
    console.log(`\n${'═'.repeat(52)}`);
    console.log(`🚀  AutomationX Gallery + RAG Server`);
    console.log(`📍  http://localhost:${PORT}`);
    console.log(`📊  Status: http://localhost:${PORT}/status`);
    console.log(`${'═'.repeat(52)}\n`);
    await initRAG();
});
