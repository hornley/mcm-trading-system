import os
import time
from supabase import create_client, Client

BUCKET_NAME = os.environ.get("SUPABASE_STORAGE_BUCKET", "product-images")

_supabase_storage_client = None


def _get_client() -> Client:
    global _supabase_storage_client
    if _supabase_storage_client is None:
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_KEY")
        if not url or not key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_KEY are required for image storage")
        _supabase_storage_client = create_client(url, key)
    return _supabase_storage_client


def upload_product_image(product_id: int, file_bytes: bytes, content_type: str, extension: str) -> str:
    client = _get_client()
    filename = f"products/{product_id}/{int(time.time() * 1000)}.{extension}"
    client.storage.from_(BUCKET_NAME).upload(
        path=filename,
        file=file_bytes,
        file_options={"content-type": content_type, "upsert": "true"},
    )
    return filename


def delete_product_image(path: str):
    client = _get_client()
    client.storage.from_(BUCKET_NAME).remove([path])


def download_product_image(path: str) -> tuple:
    client = _get_client()
    data = client.storage.from_(BUCKET_NAME).download(path)
    content_type = "image/jpeg"
    if path.endswith(".png"):
        content_type = "image/png"
    elif path.endswith(".gif"):
        content_type = "image/gif"
    elif path.endswith(".webp"):
        content_type = "image/webp"
    return data, content_type
