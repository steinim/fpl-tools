from flask import Flask, request, jsonify
import joblib
import pandas as pd
import logging
import json

app = Flask(__name__)

# Configure logging
logging.basicConfig(level=logging.DEBUG)

# Load the trained model
model = joblib.load('model/fpl_model.pkl')

# Load data files
player_history_path = './data/player_history.csv'
fixtures_path = './output/fixtures-1-38.json'
fplform_path = './output/fplform-data.csv'
players_path = './output/players-all-2024-10-13.json'

# Load the player history CSV
player_history = pd.read_csv(player_history_path)

# Load fixtures data
with open(fixtures_path) as f:
    fixtures = json.load(f)

# Load form data CSV
fplform = pd.read_csv(fplform_path, delimiter=';')

# Load players data JSON
with open(players_path) as f:
    players = json.load(f)

# Function to consolidate data for prediction
def consolidate_player_data(player_id):
    # Extract data from players, player history, and form
    player_data = next((p['player'] for p in players if p['player']['id'] == player_id), None)
    if not player_data:
        return None

    # Extract and add recent form data
    form_data = fplform[fplform['id'] == player_id].to_dict(orient='records')
    if form_data:
        form_data = form_data[0]
        player_data['form'] = form_data.get('Form (Over/under-performance over the last 4 gameweeks compared to predicted points)', 0)
        player_data['probability_of_playing_next_round'] = form_data.get('Prob. of (Probability that the player will play at all in the next match)', 100)
    
    # Extract historical performance data
    history_data = player_history[player_history['id'] == player_id].to_dict(orient='records')
    # Here you could aggregate historical data, e.g., calculating recent averages

    # Extract upcoming fixture difficulty
    if 'upcoming_fixtures' in player_data:
        fixture_difficulty = sum([f['difficulty'] for f in player_data['upcoming_fixtures']]) / len(player_data['upcoming_fixtures'])
        player_data['fixture_difficulty'] = fixture_difficulty

    return player_data

@app.route('/predict', methods=['POST'])
def predict():
    app.logger.debug('Received request at /predict')
    try:
        data = request.get_json(force=True)
        app.logger.debug(f'Request data: {data}')
        player_id = data['player_id']
        
        # Consolidate all relevant data for the given player
        player_data = consolidate_player_data(player_id)
        if not player_data:
            return jsonify({'error': 'Player data not found'}), 404
        
        # Prepare features for prediction
        features = {
            'form': player_data.get('form', 0),
            'average_points': player_data.get('average_points', 0),
            'xG': player_data.get('xG', 0),
            'xA': player_data.get('xA', 0),
            'average_minutes': player_data.get('average_minutes', 0),
            'fixture_difficulty': player_data.get('fixture_difficulty', 0)
        }

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

