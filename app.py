# app.py

from flask import Flask, request, jsonify
import joblib
import pandas as pd
import logging

app = Flask(__name__)

# Configure logging
logging.basicConfig(level=logging.DEBUG)

# Load the trained model
model = joblib.load('model/fpl_model.pkl')

@app.route('/predict', methods=['POST'])
def predict():
    app.logger.debug('Received request at /predict')
    try:
        data = request.get_json(force=True)
        app.logger.debug(f'Request data: {data}')
        features = data['features']
        # Convert features to DataFrame
        input_df = pd.DataFrame([features])
        # Ensure columns are in the same order as during training
        input_df = input_df[['form', 'average_points', 'xG', 'xA', 'average_minutes', 'fixture_difficulty']]
        # Make prediction
        prediction = model.predict(input_df)
        # Return prediction
        response = jsonify({'predicted_points': float(prediction[0])})
        app.logger.debug(f'Response data: {response.get_json()}')
        return response
    except Exception as e:
        app.logger.error(f'Error during prediction: {e}')
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=5000, debug=True)
