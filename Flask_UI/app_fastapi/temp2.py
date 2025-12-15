from flask import Flask, render_template, request, redirect, url_for, session
import requests

app = Flask(__name__)
app.secret_key = 'your_secret_key'  # Required for session handling

FASTAPI_LOGIN_URL = "http://localhost:8009/api/login"

@app.route('/')
def home():
    return redirect(url_for("login"))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == "POST":
        username = request.form['username']
        password = request.form['password']

        try:
            # Make POST request to FastAPI login endpoint
            response = requests.post(
                FASTAPI_LOGIN_URL,
                json={"username": username, "password": password}
            )

            if response.status_code == 200:
                session['username'] = username
                return redirect(url_for('chat'))
            else:
                return f"Login failed: {response.json().get('detail')}", response.status_code
        except Exception as e:
            return f"Error contacting FastAPI backend: {str(e)}", 500

    return render_template('login.html')  # A basic form with username and password fields

@app.route('/chat')
def chat():
    if 'username' in session:
        return f"Welcome {session['username']} to the chat!"
    return redirect(url_for('login'))

@app.route('/logout')
def logout():
    session.pop('username', None)
    return redirect(url_for('login'))

if __name__ == '__main__':
    app.run(debug=True, port=5000)
