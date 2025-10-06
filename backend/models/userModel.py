from config.db import get_connection
from werkzeug.security import generate_password_hash, check_password_hash

class UserModel:
    def __init__(self):
        self.conn = get_connection()
        self.conn.autocommit = True

    def create_user(self, name, email, password, phone):
        hashed = generate_password_hash(password)
        cursor = self.conn.cursor()
        try:
            cursor.execute(
                "INSERT INTO User (name, email, password, phone) VALUES (%s, %s, %s, %s)",
                (name, email, hashed, phone)
            )
            return True
        except:
            return False
        finally:
            cursor.close()

    def get_user_by_email(self, email):
        cursor = self.conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM User WHERE email = %s", (email,))
        user = cursor.fetchone()
        cursor.close()
        return user
    
    def verify_password(self, password, hashed):
        # Accept both hashed and legacy plaintext passwords
        try:
            if isinstance(hashed, str) and hashed.startswith("pbkdf2:sha256"):
                return check_password_hash(hashed, password)
            return hashed == password
        except Exception:
            return False

    def get_all_users(self):
        cursor = self.conn.cursor(dictionary=True)
        cursor.execute("SELECT user_id, name, email, phone, date_joined FROM User ORDER BY date_joined DESC, user_id DESC")
        users = cursor.fetchall()
        cursor.close()
        return users
