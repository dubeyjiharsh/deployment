import requests
import json
import os

os.environ["NO_PROXY"] = "127.0.0.1,localhost"

def upload_form(file_path):
    try:
        data = {
            'user_name': 'admin',
            'session_id': 'as0sa'
        }

        # Open the file in binary mode and construct the files dictionary
        with open(file_path, 'rb') as f:
            files = {
                'file': (os.path.basename(file_path), f, 'application/pdf')
            }

            # Send request to FastAPI endpoint
            response = requests.post('http://127.0.0.1:8010/upload', files=files, data=data)

        # Print and return response
        print(response.json())
        return response.json(), 

    except Exception as e:
        return f"Error: {str(e)}", 500

a = "fillable-form.pdf"
d = upload_form(a)
print(d)