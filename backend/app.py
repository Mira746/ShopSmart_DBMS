from flask import Flask, render_template, send_from_directory, request, redirect, url_for, session, jsonify
import mysql.connector
import os
from werkzeug.security import check_password_hash
from datetime import datetime

# Define paths to frontend
frontend_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'frontend')
templates_dir = frontend_dir
app = Flask(
    __name__,
    template_folder=templates_dir,
    static_folder=frontend_dir,
    static_url_path=''
)

# Database connection setup (centralized)
from config.db import get_connection as get_db_connection

app.secret_key = 'your_secret_key'  # Needed for session

@app.route('/')
def index():
    return render_template('start.html')


from models.userModel import UserModel

@app.route('/login_user', methods=['POST'])
def login_user():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    user_model = UserModel()
    user = user_model.get_user_by_email(email)

    if user and user_model.verify_password(password, user['password']):
        session['user_email'] = email  # Save user email in session
        return jsonify({'success': True, 'message': 'Login successful'})
    else:
        return jsonify({'success': False, 'message': 'Invalid credentials'}), 401


from models.adminModel import AdminModel

@app.route('/admin_login', methods=['POST'])
def admin_login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    admin_model = AdminModel()
    admin = admin_model.get_admin_by_email(email)

    if admin and admin_model.verify_password(password, admin['password']):
        session['admin'] = admin['email']  # Save admin email in session
        return jsonify({'success': True, 'message': 'Login successful'})
    else:
        return jsonify({'success': False, 'message': 'Invalid credentials'}), 401


@app.route('/register_user', methods=['POST'])
def register_user():
    data = request.get_json()
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')
    phone = data.get('phone')

    user_model = UserModel()
    success = user_model.create_user(name, email, password, phone)

    if success:
        session['user_email'] = email
        return jsonify({'success': True, 'message': 'Registration successful'})
    else:
        return jsonify({'success': False, 'message': 'Email already exists or error occurred'}), 400


@app.route('/register_admin', methods=['POST'])
def register_admin():
    data = request.get_json()
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')

    admin_model = AdminModel()
    if admin_model.create_admin(name, email, password):
        return jsonify({'success': True, 'message': 'Admin created successfully'})
    else:
        return jsonify({'success': False, 'message': 'Failed to create admin. Email may already exist.'}), 400


@app.route('/products', methods=['GET'])
def get_products():
    min_price = request.args.get('min', type=float, default=0)
    max_price = request.args.get('max', type=float, default=1000000)

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        "SELECT * FROM Product WHERE price BETWEEN %s AND %s",
        (min_price, max_price)
    )
    products = cursor.fetchall()
    cursor.close()
    conn.close()

    return jsonify(products)


@app.route('/checkout', methods=['POST'])
def checkout():
    if 'user_email' not in session:
        return jsonify({"success": False, "message": "User not logged in"}), 401

    data = request.get_json()
    cart = data.get('cart', [])

    if not cart:
        return jsonify({"success": False, "message": "Cart is empty"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Get user id from email stored in session
        cursor.execute("SELECT user_id FROM User WHERE email=%s", (session['user_email'],))
        user = cursor.fetchone()
        if not user:
            return jsonify({"success": False, "message": "User not found"}), 404
        user_id = user[0]

        # Insert order with current schema: total_amount, order_date, status
        total_amount = sum(float(item['price']) * int(item['qty']) for item in cart)
        order_date = datetime.now().strftime('%Y-%m-%d')
        status = 'Pending'
        cursor.execute(
            "INSERT INTO `Order` (user_id, total_amount, order_date, status) VALUES (%s, %s, %s, %s)",
            (user_id, total_amount, order_date, status)
        )
        order_id = cursor.lastrowid

        # Insert order items with robust product resolution
        for item in cart:
            product_id = None
            # Try direct numeric id
            try:
                product_id = int(item.get('id'))
            except Exception:
                product_id = None

            # Fallback: resolve by product name
            if not product_id:
                name = str(item.get('name', '')).strip()
                if name:
                    cursor.execute("SELECT product_id FROM Product WHERE name = %s", (name,))
                    row = cursor.fetchone()
                    if row:
                        product_id = int(row[0])

            # Last resort: resolve by price (may be ambiguous)
            if not product_id:
                try:
                    price_value = float(item.get('price'))
                    cursor.execute("SELECT product_id FROM Product WHERE price = %s ORDER BY product_id LIMIT 1", (price_value,))
                    row = cursor.fetchone()
                    if row:
                        product_id = int(row[0])
                except Exception:
                    pass

            if not product_id:
                conn.rollback()
                return jsonify({"success": False, "message": f"Unknown product: {item}"}), 400

            cursor.execute(
                "INSERT INTO OrderItem (order_id, product_id, quantity, price) VALUES (%s, %s, %s, %s)",
                (order_id, product_id, int(item.get('qty', 1)), float(item.get('price', 0)))
            )

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"success": True, "order_id": order_id})

    except Exception as e:
        print("Checkout Error:", e)
        return jsonify({"success": False, "message": "Server error"}), 500
    


@app.route('/admin_dashboard')
def admin_dashboard():
    return render_template('admin_dashboard.html')


@app.route('/admin_customers')
def admin_customers():
    return render_template('admin_customers.html')


@app.route('/css/<path:filename>')
def css(filename):
    return send_from_directory(os.path.join(frontend_dir, 'css'), filename)


@app.route('/js/<path:filename>')
def js(filename):
    return send_from_directory(os.path.join(frontend_dir, 'js'), filename)


@app.route('/images/<path:filename>')
def images(filename):
    return send_from_directory(os.path.join(frontend_dir, 'images'), filename)


# Simple CORS support (for development/testing)
@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    return response


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
