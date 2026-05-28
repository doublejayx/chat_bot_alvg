// ================================================================
//  knowledgebase.js  —  Persistent Vector Store (pure JS, no compile)
//  ใช้ cosine similarity กับ JSON index แทน hnswlib
// ================================================================

const fs   = require('fs');
const path = require('path');

const VECTOR_DIR = path.join(__dirname, 'data', 'vector_store');
const DATA_FILE  = path.join(__dirname, 'data', 'avalant_media.txt');
const INDEX_FILE = path.join(VECTOR_DIR, 'index.json');

async function getLangChainModules() {
    const { OllamaEmbeddings }           = await import('@langchain/ollama');
    const { RecursiveCharacterTextSplitter } = await import('@langchain/textsplitters');
    const { Document }                   = await import('@langchain/core/documents');
    return { OllamaEmbeddings, RecursiveCharacterTextSplitter, Document };
}

function vectorStoreExists() {
    return fs.existsSync(INDEX_FILE);
}

// ── BUILD: อ่านไฟล์ → chunk → embed → บันทึก JSON ────────────────
async function buildVectorStore(ollamaBaseUrl, embeddingModel) {
    console.log('📚 Building vector store from', DATA_FILE);

    if (!fs.existsSync(DATA_FILE)) {
        throw new Error(`ไม่พบไฟล์: ${DATA_FILE}`);
    }

    const { OllamaEmbeddings, RecursiveCharacterTextSplitter, Document } =
        await getLangChainModules();

    const rawText = fs.readFileSync(DATA_FILE, 'utf-8');
    console.log(`   อ่านข้อมูล: ${rawText.length} ตัวอักษร`);

    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize:    800,
        chunkOverlap: 150,
    });
    const docs = await splitter.splitDocuments([
        new Document({ pageContent: rawText, metadata: { source: DATA_FILE } }),
    ]);
    console.log(`   แบ่งได้: ${docs.length} chunks`);

    const embeddings = new OllamaEmbeddings({
        model:   embeddingModel,
        baseUrl: ollamaBaseUrl,
    });

    console.log('   กำลัง embed... (อาจใช้เวลาสักครู่)');
    const entries = [];
    for (let i = 0; i < docs.length; i++) {
        const vec = await embeddings.embedQuery(docs[i].pageContent);
        entries.push({ id: i, text: docs[i].pageContent, vector: vec });
        if ((i + 1) % 5 === 0) console.log(`   embed แล้ว ${i + 1}/${docs.length}`);
    }

    fs.mkdirSync(VECTOR_DIR, { recursive: true });
    fs.writeFileSync(INDEX_FILE, JSON.stringify({
        builtAt: new Date().toISOString(),
        chunks:  entries.length,
        entries,
    }));

    console.log(`✅ Vector store บันทึกแล้ว: ${entries.length} chunks`);
    return entries;
}

// ── cosine similarity ─────────────────────────────────────────────
function cosineSim(a, b) {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot   += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ── LOAD: โหลดจาก disk + ส่งคืน object ที่มี asRetriever() ──────
async function loadVectorStore(ollamaBaseUrl, embeddingModel) {
    const data = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'));
    console.log(`📂 โหลด vector store แล้ว (${data.chunks} chunks, built: ${data.builtAt})`);

    const { OllamaEmbeddings } = await getLangChainModules();
    const embeddings = new OllamaEmbeddings({ model: embeddingModel, baseUrl: ollamaBaseUrl });

    return {
        asRetriever: ({ k = 4 } = {}) => ({
            invoke: async (query) => {
                const qVec   = await embeddings.embedQuery(query);
                const scored = data.entries.map(e => ({
                    text:  e.text,
                    score: cosineSim(qVec, e.vector),
                }));
                scored.sort((a, b) => b.score - a.score);
                return scored.slice(0, k).map(s => ({ pageContent: s.text, metadata: {} }));
            },
        }),
    };
}

// ── MAIN: โหลดถ้ามี สร้างใหม่ถ้าไม่มี ───────────────────────────
async function getVectorStore(ollamaBaseUrl, embeddingModel) {
    if (vectorStoreExists()) {
        return await loadVectorStore(ollamaBaseUrl, embeddingModel);
    }
    console.log('⚠️  ไม่พบ vector store — กำลังสร้างใหม่...');
    await buildVectorStore(ollamaBaseUrl, embeddingModel);
    return await loadVectorStore(ollamaBaseUrl, embeddingModel);
}

module.exports = { getVectorStore, buildVectorStore, vectorStoreExists, VECTOR_DIR };
