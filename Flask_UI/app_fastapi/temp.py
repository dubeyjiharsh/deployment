from flask import Flask, render_template, request, redirect, url_for, session
import requests

print(f"Attempting login for user:",flush=True)
            # Call FastAPI login endpoint

payload = {
                "username": "Anand",
                "password": "Anand123"
            }
URL = "http://127.0.0.1:8009/api/login"
response = requests.post(URL, json=payload)

print(response.status_code, "\n", response)