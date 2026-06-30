# migrate_biometric_cleanup.py
"""
One-time migration script to clean up duplicate biometric_id values
across employees before enforcing the unique sparse index.

Run this BEFORE deploying the new code that adds the unique index.

Steps:
  1. Find duplicate biometric_id values across employees
  2. Keep the most recently created employee for each duplicate
  3. Nullify biometric_id from the older duplicates
  4. Report cleanup summary
"""

import os
import sys
from datetime import datetime

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import get_db, employees_col


def find_duplicate_biometric_ids():
    """Find all biometric_id values that appear on more than one employee."""
    pipeline = [
        {"$match": {"biometric_id": {"$exists": True, "$ne": None}}},
        {"$group": {
            "_id": "$biometric_id",
            "count": {"$sum": 1},
            "employees": {"$push": {
                "employee_id": "$employee_id",
                "name": "$name",
                "created_at": "$created_at",
                "_id": "$_id"
            }}
        }},
        {"$match": {"count": {"$gt": 1}}},
        {"$sort": {"_id": 1}}
    ]
    return list(employees_col().aggregate(pipeline))


def cleanup_duplicates(dry_run: bool = True):
    """
    Clean up duplicate biometric_id values.
    
    For each duplicate group, keeps the most recently created employee
    and nullifies the biometric_id on older duplicates.
    
    Args:
        dry_run: If True, only reports what would be changed without modifying data.
    """
    print("\n" + "=" * 60)
    print("🧹 Biometric ID Duplicate Cleanup Migration")
    print("=" * 60)
    
    if dry_run:
        print("⚠️  DRY RUN MODE - No changes will be made.\n")
    else:
        print("🔴 LIVE MODE - Changes will be applied!\n")

    duplicates = find_duplicate_biometric_ids()
    
    if not duplicates:
        print("✅ No duplicate biometric_id values found. Database is clean!")
        return

    print(f"⚠️  Found {len(duplicates)} biometric_id(s) with duplicates:\n")
    
    total_cleaned = 0
    
    for dup in duplicates:
        bio_id = dup["_id"]
        count = dup["count"]
        employees = dup["employees"]
        
        print(f"  📋 Biometric ID {bio_id} — {count} employees:")
        
        # Sort by created_at descending (most recent first)
        # Handle missing created_at by treating it as very old
        def sort_key(emp):
            created = emp.get("created_at", "")
            if not created:
                return ""
            return created
        
        employees.sort(key=sort_key, reverse=True)
        
        # Keep the first (most recent), nullify the rest
        keeper = employees[0]
        print(f"     ✅ KEEP: {keeper['employee_id']} ({keeper['name']})")
        
        for old_emp in employees[1:]:
            print(f"     ❌ REMOVE biometric_id from: {old_emp['employee_id']} ({old_emp['name']})")
            
            if not dry_run:
                employees_col().update_one(
                    {"_id": old_emp["_id"]},
                    {"$unset": {"biometric_id": ""}}
                )
            total_cleaned += 1
        
        print()
    
    print(f"\n📊 Summary: {total_cleaned} employee(s) had biometric_id removed.")
    
    if dry_run:
        print("\n💡 Run with --apply to execute the cleanup:")
        print("   python migrate_biometric_cleanup.py --apply")


def verify_index():
    """Check if the unique sparse index on biometric_id exists."""
    print("\n" + "=" * 60)
    print("🔍 Verifying biometric_id index")
    print("=" * 60)
    
    indexes = employees_col().index_information()
    bio_index = None
    
    for name, info in indexes.items():
        keys = info.get("key", [])
        for key_name, _ in keys:
            if key_name == "biometric_id":
                bio_index = info
                break
    
    if bio_index:
        is_unique = bio_index.get("unique", False)
        is_sparse = bio_index.get("sparse", False)
        print(f"  ✅ Index found: unique={is_unique}, sparse={is_sparse}")
        if is_unique and is_sparse:
            print("  ✅ Index is correctly configured (unique + sparse).")
        else:
            print("  ⚠️  Index exists but configuration may need updating.")
    else:
        print("  ❌ No index found on biometric_id.")
        print("  💡 The unique sparse index will be created automatically when the app starts.")


def main():
    print("🔌 Connecting to database...")
    db = get_db()
    print(f"✅ Connected to: {db.name}")
    
    # Check for --apply flag
    apply_mode = "--apply" in sys.argv
    
    # Step 1: Find and clean duplicates
    cleanup_duplicates(dry_run=not apply_mode)
    
    # Step 2: Verify index
    verify_index()
    
    print("\n" + "=" * 60)
    print("🎉 Migration script complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
