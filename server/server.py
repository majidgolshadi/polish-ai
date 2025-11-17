#!/usr/bin/env python3
"""
Polish AI Server
Receives text data from the Firefox extension and rewrites it to C2 level English using Qwen2.5-1.5B Instruct.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import json
from datetime import datetime
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch

app = Flask(__name__)
CORS(app)  # Enable CORS for cross-origin requests from the extension

# Initialize the model and tokenizer
print("Loading Qwen2.5-1.5B Instruct model...")
model_name = "Qwen/Qwen2.5-1.5B-Instruct"
tokenizer = None
model = None

def load_model():
    """Load the Qwen2.5-1.5B Instruct model."""
    global tokenizer, model
    try:
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModelForCausalLM.from_pretrained(
            model_name,
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
            device_map="auto" if torch.cuda.is_available() else None
        )
        if not torch.cuda.is_available():
            model = model.to("cpu")
        model.eval()
        print("Model loaded successfully!")
    except Exception as e:
        print(f"Error loading model: {e}")
        raise

def rewrite_to_c2_english(text):
    """Rewrite text to C2 level English using Qwen2.5-1.5B Instruct."""
    if not model or not tokenizer:
        return text
    
    # Use Qwen's chat template format
    messages = [
        {
            "role": "system",
            "content": "You are a professional English language editor. Rewrite the given text to C2 level (proficient) English. Make it more sophisticated, eloquent, and grammatically perfect while preserving the original meaning."
        },
        {
            "role": "user",
            "content": f"Rewrite this text to C2 level English: {text}"
        }
    ]
    
    try:
        # Apply chat template
        text_prompt = tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True
        )
        
        # Tokenize the input
        inputs = tokenizer(text_prompt, return_tensors="pt", truncation=True, max_length=512)
        
        # Move inputs to the same device as the model
        device = next(model.parameters()).device
        inputs = {k: v.to(device) for k, v in inputs.items()}
        
        # Generate response
        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=256,
                temperature=0.7,
                do_sample=True,
                top_p=0.9,
                pad_token_id=tokenizer.eos_token_id
            )
        
        # Extract only the newly generated tokens (not the input prompt)
        input_length = inputs['input_ids'].shape[1]
        generated_tokens = outputs[0][input_length:]
        
        # Decode only the generated part
        rewritten_text = tokenizer.decode(generated_tokens, skip_special_tokens=True).strip()
        
        # Clean up any remaining template tokens
        rewritten_text = rewritten_text.replace("<|im_end|>", "").replace("<|im_start|>", "").strip()
        
        return rewritten_text if rewritten_text else text
    except Exception as e:
        print(f"Error during text rewriting: {e}")
        import traceback
        traceback.print_exc()
        return text  # Return original text on error

@app.route('/api/text', methods=['POST'])
def receive_text():
    """Receive text from the extension, rewrite it to C2 level English, and return it."""
    try:
        data = request.get_json()
        
        if data and 'text' in data:
            text = data['text']
            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            
            # Print to console/log
            print(f"\n[{timestamp}] Received text from extension:")
            print(f"Original text: {text}")
            print(f"Length: {len(text)} characters")
            
            # Rewrite text to C2 level English
            print("Rewriting to C2 level English...")
            rewritten_text = rewrite_to_c2_english(text)
            print(f"Rewritten text: {rewritten_text}")
            print("-" * 80)
            
            return jsonify({
                'success': True,
                'message': rewritten_text,  # Return the rewritten text in message field
                'timestamp': timestamp
            }), 200
        else:
            print(f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Error: No text field in request")
            return jsonify({
                'success': False,
                'message': 'No text field in request'
            }), 400
            
    except Exception as e:
        error_msg = str(e)
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        print(f"\n[{timestamp}] Error processing request: {error_msg}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': f'Error: {error_msg}'
        }), 500


if __name__ == '__main__':
    print("=" * 80)
    print("Polish AI Server starting on http://localhost:3000")
    print("Loading Qwen2.5-1.5B Instruct model...")
    print("=" * 80)
    
    # Load the model before starting the server
    try:
        load_model()
        print("=" * 80)
        print("Server ready! Waiting for text data from browser...")
        print("=" * 80)
        app.run(host='0.0.0.0', port=3000, debug=True)
    except Exception as e:
        print(f"Failed to start server: {e}")
        import traceback
        traceback.print_exc()

