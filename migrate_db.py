import pymongo
from pymongo.errors import BulkWriteError

def migrate_database():
    print("🚀 Starting Database Migration...")
    
    # 1. Local Database Connection
    local_uri = "mongodb://localhost:27017"
    local_client = pymongo.MongoClient(local_uri)
    local_db = local_client["hr_attendance"]
    
    # 2. Remote Atlas Database Connection
    remote_uri = "mongodb+srv://mahmoudb612:Mahmoud2002@cluster0.xql03kr.mongodb.net/?appName=Cluster0"
    remote_client = pymongo.MongoClient(remote_uri)
    remote_db = remote_client["hr_attendance"]
    
    # 3. Get all collections from local DB
    collections = local_db.list_collection_names()
    print(f"📦 Found {len(collections)} collections in local database: {collections}")
    
    for coll_name in collections:
        local_collection = local_db[coll_name]
        remote_collection = remote_db[coll_name]
        
        # Get all documents from local
        docs = list(local_collection.find())
        if not docs:
            print(f"⚠️ Collection '{coll_name}' is empty. Skipping.")
            continue
            
        print(f"⏳ Copying {len(docs)} documents from '{coll_name}'...")
        
        # We drop the remote collection first to avoid duplicate key errors on _id
        # and ensure a clean 1-to-1 copy.
        remote_collection.drop()
        
        try:
            remote_collection.insert_many(docs)
            print(f"✅ Successfully copied '{coll_name}'.")
        except BulkWriteError as bwe:
            print(f"❌ Error copying '{coll_name}': {bwe.details}")
        except Exception as e:
            print(f"❌ Unexpected error on '{coll_name}': {str(e)}")

    print("\n🎉 Migration Complete! All your local data is now on MongoDB Atlas.")

if __name__ == "__main__":
    migrate_database()
