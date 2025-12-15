from flask import Flask, jsonify, render_template, request, redirect, url_for, session
import requests
import json
import uuid
import os
os.environ["NO_PROXY"] = "127.0.0.1,localhost"

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
            response = requests.post(f"http://127.0.0.1:8080/api/login", json={
                "username": username,
                "password": password
            })
            print(f"FastAPI response: {response.status_code} - {response.text}", flush=True)
            if response.status_code == 200:
                print(f"Login successful for user: {username}", flush=True)
                session['username'] = username
                session['session_id']=str(uuid.uuid4())  # Generate a unique session ID
                print(f"Session ID set for user {username}: {session['session_id']}", flush=True)
                return render_template("chat.html", username=username, session_id=session['session_id'])
            return "Invalid credentials", response.status_code
        except Exception as e:
            return f"Error calling FastAPI login: {str(e)}", 500
    return render_template("login.html")

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        try:
            response = requests.post(f"http://127.0.0.1:8080/register/newuser", json={
                "username": username,
                "password": password
            })

            if response.status_code == 200:
                return redirect(url_for('login'))
            elif response.status_code == 409:
                return "User already exists", 409
            else:
                return f"Registration failed: {response.text}", response.status_code

        except Exception as e:
            return f"FastAPI connection error: {str(e)}", 500
    return render_template('register.html')


# Declare a global variable for doc_id
doc_id_global = None

@app.route('/upload_form', methods=['POST'])
def upload_form():
    global doc_id_global
    try:
        file = request.files['pdf_file']
        files = {
            'file': (file.filename, file.stream, file.mimetype)
        }
        # Use username and session_id from Flask session
        data = {
            'user_name': session.get('username'),
            'session_id': session.get('session_id')
        }
        response = requests.post('http://127.0.0.1:8080/upload', files=files, data=data)
        resp_json = response.json()
        doc_id_global = resp_json.get('doc_id')
        session['doc_id'] = doc_id_global
        return jsonify(resp_json)
    except Exception as e:
        return f"Error: {str(e)}", 500

@app.route('/chat', methods=['GET', 'POST'])
def chat():
    global doc_id_global
    if 'username' not in session:
        return redirect(url_for('login'))

    if request.method == 'POST':
        data = request.json
        user_input = data["user_message"]
        username = data["user_name"]
        session_id = session.get('session_id')
        # Use document_id from payload, fallback to session/global if not present
        document_id = data.get('document_id') or session.get('doc_id') or doc_id_global
        print("session_id:", session_id)
        print("document_id11:", document_id)

        payload = {
            "session_id": session_id,
            "user_name": username,
            "user_message": user_input,
            "confirmation": "True"
        }

        try:
            response = requests.post(
                "http://127.0.0.1:8080/ada",
                data={
                    "request": json.dumps(payload),
                    "document_id": document_id  # Pass as a separate form field
                }
            )
            if response.status_code == 200:
                return response.json()
            else:
                return {"bot_message": "Error from backend"}
        except Exception as e:
            return f"Failed to connect to FastAPI: {str(e)}", 500

    return render_template("chat.html", username=session.get('username'), session_id=session.get('session_id'))

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
    app.run(debug=True, port=5001)
