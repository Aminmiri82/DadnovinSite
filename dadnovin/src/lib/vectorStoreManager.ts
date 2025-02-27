import { embed, embedMany, cosineSimilarity } from "ai";
import { openai } from "@ai-sdk/openai";
import * as fs from "fs/promises";
import * as path from "path";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

const VECTOR_STORE_PATH = "./vector-store";
const DOCS_FILE = path.join(VECTOR_STORE_PATH, "docs.json");

interface Document {
  pageContent: string;
  embedding: number[];
}

class VectorStore {
  private _documents: Document[] = [];

  get documents(): Document[] {
    return this._documents;
  }

  async addDocuments(texts: string[]) {
    const { embeddings } = await embedMany({
      model: openai.embedding("text-embedding-3-large"),
      values: texts,
    });

    this._documents = texts.map((text, i) => ({
      pageContent: text,
      embedding: embeddings[i],
    }));

    console.log(`Added ${this._documents.length} documents to vector store`);
  }

  async similaritySearch(query: string, k: number = 5): Promise<Document[]> {
    console.log(`Searching through ${this._documents.length} documents`);

    const { embedding: queryEmbedding } = await embed({
      model: openai.embedding("text-embedding-3-large"),
      value: query,
    });

    const SIMILARITY_THRESHOLD = 0.1;

    const results = this._documents
      .map((doc) => ({
        ...doc,
        similarity: cosineSimilarity(queryEmbedding, doc.embedding),
      }))
      .sort((a, b) => b.similarity - a.similarity);

    console.log(
      "Top 3 raw similarities:",
      results
        .slice(0, 3)
        .map(
          (d) =>
            `${Math.round(d.similarity * 100)}% - "${d.pageContent.slice(
              0,
              50
            )}..."`
        )
    );

    return results
      .filter((doc) => doc.similarity > SIMILARITY_THRESHOLD)
      .slice(0, k);
  }
}

async function loadDocumentsFromDirectory(directoryPath: string) {
  try {
    const files = await fs.readdir(directoryPath);
    const textFiles = files.filter((file) => file.endsWith(".txt"));

    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const documents = [];
    for (const file of textFiles) {
      const filePath = path.join(directoryPath, file);
      const content = await fs.readFile(filePath, "utf-8");
      const docs = await textSplitter.createDocuments([content]);
      documents.push(...docs.map((doc) => doc.pageContent));
    }

    return documents;
  } catch (error) {
    console.error("Error loading documents:", error);
    return [];
  }
}

async function saveVectorStore(store: VectorStore) {
  await fs.mkdir(VECTOR_STORE_PATH, { recursive: true });
  await fs.writeFile(DOCS_FILE, JSON.stringify(store));
  console.log(`Vector store saved to ${DOCS_FILE}`);
}

async function loadOrCreateVectorStore() {
  const store = new VectorStore();

  try {
    console.log("Loading existing vector store...");
    const content = await fs.readFile(DOCS_FILE, "utf-8");
    const parsed = JSON.parse(content);
    Object.assign(store, parsed);
    console.log(`Loaded ${store.documents.length} documents from storage`);
    return store;
  } catch (error) {
    console.log("Creating new vector store...");
    const documents = await loadDocumentsFromDirectory("./data");
    console.log(`Found ${documents.length} text chunks in data directory`);

    if (documents.length === 0) {
      console.warn("No documents found in the data directory!");
    }

    await store.addDocuments(documents);
    await saveVectorStore(store);
    return store;
  }
}

export { loadOrCreateVectorStore };
