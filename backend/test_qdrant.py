from config import get_settings
from qdrant_client import QdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchValue
from langchain_huggingface import HuggingFaceEmbeddings

s = get_settings()
print("Connecting to Qdrant with 120s timeout...")
q = QdrantClient(url=s.qdrant_url, api_key=s.qdrant_api_key, timeout=120)
print("Connected!")

print("Loading embeddings...")
e = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2", model_kwargs={"device": "cpu"})
print("Embeddings loaded!")

print("Running test search...")
vec = e.embed_query("test query")
results = q.query_points(
    collection_name=s.qdrant_collection,
    query=vec,
    limit=3,
    with_payload=True,
).points
print(f"Search returned {len(results)} results")
for r in results:
    print(f"  score={r.score:.3f} doc_id={r.payload.get('document_id', '?')}")