from flask import Flask, render_template, request, redirect, url_for, session
import requests
app = Flask(__name__)
# Secret key for session management
app.secret_key = 'your_secret_key'
# Dummy user store (replace with DB later)
users = {
    'admin': 'admin'  # pre-defined user
}

@app.route('/')
def home():
    return redirect(url_for("login"))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        try:
            print(f"Attempting login for user: {username}", flush=True)
            # Call FastAPI login endpoint
            response = requests.post("http://127.0.0.1:8009/api/login", json={
                "username": username,
                "password": password
            })
            print(f"FastAPI response: {response.status_code} - {response.text}", flush=True)
            if response.status_code == 200:
                print(f"Login successful for user: {username}", flush=True)
                session['username'] = username
                return redirect(url_for('chat'))
            return "Invalid credentials", response.status_code
        except Exception as e:
            return f"Error calling FastAPI login: {str(e)}", 500
    return render_template("login.html")

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        try:
            username = request.form['username']
            password = request.form['password']
            if username in users:
                return "User already exists", 409
            users[username] = password
            return redirect(url_for('login'))
        except Exception as e:
            return f"Error: {str(e)}", 500
    return render_template('register.html')

@app.route('/chat')
def chat():
    if 'username' in session:
        return render_template('chat.html')
    return redirect(url_for('login'))

@app.route('/logout')
def logout():
    session.pop('username', None)
    return redirect(url_for('login'))
# @app.route('/forgot-password', methods=['GET', 'POST'])
# def forgot_password():
#     if request.method == 'POST':
#         email = request.form['email']
#         # : Implement actual reset logic
#         return f"Reset instructions sent to {email}"
#     return render_template('forgot_password.html')

if __name__ == '__main__':
    app.run(debug=True,port=5003)
