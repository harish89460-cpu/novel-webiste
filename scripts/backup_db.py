import mysql.connector

conn = mysql.connector.connect(host='localhost', port=3306, user='root', password='root', database='rp_novels_db')
cursor = conn.cursor()
cursor.execute('SHOW TABLES')
tables = [r[0] for r in cursor.fetchall()]

with open('database_backup_fresh_init.sql', 'w', encoding='utf-8') as f:
    f.write('-- MySQL Dump generated for fresh initialization\nSET FOREIGN_KEY_CHECKS=0;\n\n')
    for table in tables:
        cursor.execute(f'SHOW CREATE TABLE `{table}`')
        create_table = cursor.fetchone()[1]
        f.write(f'DROP TABLE IF EXISTS `{table}`;\n{create_table};\n\n')
        
        cursor.execute(f'SELECT * FROM `{table}`')
        rows = cursor.fetchall()
        if rows:
            cursor.execute(f'DESCRIBE `{table}`')
            cols = [f'`{c[0]}`' for c in cursor.fetchall()]
            cols_str = ', '.join(cols)
            for row in rows:
                vals = []
                for val in row:
                    if val is None:
                        vals.append('NULL')
                    elif isinstance(val, (int, float)):
                        vals.append(str(val))
                    else:
                        escaped = str(val).replace("'", "''").replace('\\', '\\\\')
                        vals.append(f"'{escaped}'")
                vals_joined = ', '.join(vals)
                f.write(f'INSERT INTO `{table}` ({cols_str}) VALUES ({vals_joined});\n')
            f.write('\n')
    f.write('SET FOREIGN_KEY_CHECKS=1;\n')

print('SQL backup successfully written to database_backup_fresh_init.sql')
cursor.close()
conn.close()
