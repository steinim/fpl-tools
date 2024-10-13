import json

file_path = './output/players-all-2024-10-13.json'
try:
    with open(file_path, 'r') as f:
        data = json.load(f)
    print("JSON loaded successfully.")
except json.JSONDecodeError as e:
    print(f"Error loading JSON: {e}")

