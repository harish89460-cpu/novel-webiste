import mysql.connector

def run_fresh_cleanup():
    conn = mysql.connector.connect(
        host='localhost',
        port=3306,
        user='root',
        password='root',
        database='rp_novels_db'
    )
    cursor = conn.cursor(dictionary=True)
    
    print("Beginning safe clean database initialization...")
    
    # 1. Verify author account exists before touching anything
    cursor.execute("SELECT id, username, email, role FROM users WHERE id = 2 AND username = 'rudhra_author'")
    author = cursor.fetchone()
    if not author:
        raise Exception("ABORT: Authorized author account (id=2, username='rudhra_author') not found in users table!")
    print("Verified authorized author account: id=2, username='rudhra_author'")
    
    # Disable foreign keys for atomic cleanup
    cursor.execute("SET FOREIGN_KEY_CHECKS = 0;")
    
    # 2. Clear content tables
    content_tables = [
        'comments',
        'reactions',
        'likes',
        'reading_progress',
        'chapters',
        'novels',
        'media',
        'notifications',
        'forum_posts',
        'forum_topics',
        'password_resets',
        'sessions'
    ]
    for tbl in content_tables:
        cursor.execute(f"DELETE FROM `{tbl}`;")
        cursor.execute(f"ALTER TABLE `{tbl}` AUTO_INCREMENT = 1;")
        print(f"  [OK] Cleaned table: {tbl}")
        
    # 3. Clean user accounts preserving only author id=2
    cursor.execute("DELETE FROM activity_status WHERE user_id != 2;")
    print("  [OK] Cleaned activity_status for non-author accounts")
    
    cursor.execute("DELETE FROM profiles WHERE user_id != 2;")
    print("  [OK] Cleaned profiles for non-author accounts")
    
    cursor.execute("DELETE FROM users WHERE id != 2;")
    print("  [OK] Cleaned users table (preserved author id=2)")
    
    cursor.execute("SET FOREIGN_KEY_CHECKS = 1;")
    conn.commit()
    
    # 4. Verification of counts
    print("\n--- Verification After Fresh Clean ---")
    cursor.execute("SHOW TABLES")
    tables = [list(r.values())[0] for r in cursor.fetchall()]
    for t in tables:
        cursor.execute(f"SELECT COUNT(*) as count FROM `{t}`")
        cnt = cursor.fetchone()['count']
        print(f"  {t}: {cnt}")
        
    cursor.execute("SELECT id, username, email, role FROM users")
    users = cursor.fetchall()
    print("\nRemaining users:", users)
    
    cursor.close()
    conn.close()
    print("\nFresh Database Initialization Complete!")

if __name__ == '__main__':
    run_fresh_cleanup()
