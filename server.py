import os
import sys
import json
import uuid
import threading
from urllib.parse import urlparse, parse_qs
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

# In-memory database for lobbies and game states
lobbies = {}
lobbies_lock = threading.Lock()

DECKS_DIR = "decks"

def init_decks_directory():
    os.makedirs(DECKS_DIR, exist_ok=True)
    # Check if empty, and seed a default starter deck if so
    files = [f for f in os.listdir(DECKS_DIR) if f.endswith(".json")]
    if not files:
        default_deck = {
            "id": "starter_draco_plus",
            "name": "Starter Deck Draco Plus",
            "characterId": "bs_2",
            "cardIds": ["bs_114"] * 30 + ["bs_115"] * 30,
            "isPreset": True
        }
        try:
            filepath = os.path.join(DECKS_DIR, "starter_draco_plus.json")
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(default_deck, f, indent=2)
            print("Seeded default starter deck to decks/starter_draco_plus.json")
        except Exception as e:
            print(f"Error seeding starter deck: {e}")

class GameLobby:
    def __init__(self, lobby_id, host_name, host_deck, is_debug=False):
        self.lobby_id = lobby_id
        self.host_name = host_name
        self.host_deck = host_deck
        self.guest_name = None
        self.guest_deck = None
        self.status = "waiting" # waiting, playing, ended
        self.game_state = None
        self.actions = [] # actions queue from guest to host
        self.is_debug = is_debug
        self.lock = threading.Lock()

class LANPlayRequestHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        # Always print server errors (which use a format string containing "code")
        if "code" in format:
            super().log_message(format, *args)
            return

        # Quiet output for standard requests unless they are API calls
        try:
            str_args = [str(arg) for arg in args]
            if len(str_args) > 0 and "/api/" in str_args[0]:
                super().log_message(format, *args)
        except Exception:
            pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_OPTIONS(self):
        # Support CORS preflight requests
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        
        if path.startswith("/api/"):
            self.handle_api_get(path, parsed_url.query)
        else:
            # Fallback to serving static files
            super().do_GET()

    def do_POST(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        
        if path.startswith("/api/"):
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length).decode('utf-8')
            try:
                body = json.loads(post_data) if post_data else {}
            except Exception:
                body = {}
            self.handle_api_post(path, body)
        else:
            self.send_error(404, "Not Found")

    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def handle_api_get(self, path, query_str):
        query = parse_qs(query_str)
        
        if path == "/api/lobbies":
            active_lobbies = []
            with lobbies_lock:
                for lid, lobby in lobbies.items():
                    if lobby.status == "waiting":
                        active_lobbies.append({
                            "gameId": lobby.lobby_id,
                            "hostName": lobby.host_name,
                            "status": lobby.status,
                            "isDebug": lobby.is_debug
                        })
            self.send_json({"lobbies": active_lobbies})
            
        elif path == "/api/decks":
            decks = []
            if os.path.exists(DECKS_DIR):
                for filename in os.listdir(DECKS_DIR):
                    if filename.endswith(".json"):
                        try:
                            with open(os.path.join(DECKS_DIR, filename), "r", encoding="utf-8") as f:
                                decks.append(json.load(f))
                        except Exception as e:
                            print(f"Error reading {filename}: {e}")
            self.send_json(decks)
            
        elif path.startswith("/api/lobbies/"):
            parts = path.split('/')
            if len(parts) >= 5 and parts[4] == "poll":
                game_id = parts[3]
                lobby = None
                with lobbies_lock:
                    lobby = lobbies.get(game_id)
                if lobby:
                    with lobby.lock:
                        self.send_json({
                            "gameId": lobby.lobby_id,
                            "status": lobby.status,
                            "hostName": lobby.host_name,
                            "hostDeck": lobby.host_deck,
                            "guestName": lobby.guest_name,
                            "guestDeck": lobby.guest_deck,
                            "hasStarted": (lobby.status == "playing"),
                            "isDebug": lobby.is_debug
                        })
                else:
                    self.send_json({"error": "Lobby not found"}, 404)
                    
        elif path.startswith("/api/game/"):
            parts = path.split('/')
            if len(parts) >= 5:
                game_id = parts[3]
                sub_path = parts[4]
                lobby = None
                with lobbies_lock:
                    lobby = lobbies.get(game_id)
                if lobby:
                    with lobby.lock:
                        if sub_path == "state":
                            self.send_json({"gameState": lobby.game_state})
                        elif sub_path == "action":
                            actions = list(lobby.actions)
                            lobby.actions.clear()
                            self.send_json({"actions": actions})
                        else:
                            self.send_error(404, "Endpoint not found")
                else:
                    self.send_json({"error": "Game not found"}, 404)
        else:
            self.send_error(404, "Endpoint not found")

    def handle_api_post(self, path, body):
        if path == "/api/lobbies/create":
            host_name = body.get("hostName", "Host")
            host_deck = body.get("hostDeck")
            is_debug = body.get("isDebug", False)
            game_id = str(uuid.uuid4())[:8]
            
            with lobbies_lock:
                lobbies[game_id] = GameLobby(game_id, host_name, host_deck, is_debug)
                
            self.send_json({"gameId": game_id})
            
        elif path == "/api/decks/save":
            deck_id = body.get("id")
            if not deck_id:
                self.send_json({"error": "Missing deck ID"}, 400)
                return
            safe_id = "".join(c for c in deck_id if c.isalnum() or c in ("-", "_"))
            if not safe_id:
                self.send_json({"error": "Invalid deck ID"}, 400)
                return
            filepath = os.path.join(DECKS_DIR, f"{safe_id}.json")
            try:
                with open(filepath, "w", encoding="utf-8") as f:
                    json.dump(body, f, indent=2)
                self.send_json({"success": True})
            except Exception as e:
                self.send_json({"error": f"Failed to save deck: {e}"}, 500)
                
        elif path == "/api/decks/delete":
            deck_id = body.get("id")
            if not deck_id:
                self.send_json({"error": "Missing deck ID"}, 400)
                return
            safe_id = "".join(c for c in deck_id if c.isalnum() or c in ("-", "_"))
            filepath = os.path.join(DECKS_DIR, f"{safe_id}.json")
            if os.path.exists(filepath):
                try:
                    os.remove(filepath)
                    self.send_json({"success": True})
                except Exception as e:
                    self.send_json({"error": f"Failed to delete deck: {e}"}, 500)
            else:
                self.send_json({"error": "Deck not found"}, 404)
            
        elif path == "/api/lobbies/join":
            game_id = body.get("gameId")
            guest_name = body.get("guestName", "Guest")
            guest_deck = body.get("guestDeck")
            
            lobby = None
            with lobbies_lock:
                lobby = lobbies.get(game_id)
            if lobby:
                with lobby.lock:
                    if lobby.status != "waiting":
                        self.send_json({"error": "Game already started or finished"}, 400)
                        return
                    lobby.guest_name = guest_name
                    lobby.guest_deck = guest_deck
                    self.send_json({"success": True, "hostDeck": lobby.host_deck, "isDebug": lobby.is_debug})
            else:
                self.send_json({"error": "Lobby not found"}, 404)

        elif path == "/api/lobbies/update-deck":
            game_id = body.get("gameId")
            role = body.get("role") # 'host' or 'guest'
            deck = body.get("deck")
            
            lobby = None
            with lobbies_lock:
                lobby = lobbies.get(game_id)
            if lobby:
                with lobby.lock:
                    if role == 'host':
                        lobby.host_deck = deck
                    else:
                        lobby.guest_deck = deck
                    self.send_json({"success": True})
            else:
                self.send_json({"error": "Lobby not found"}, 404)
                
        elif path.startswith("/api/game/"):
            parts = path.split('/')
            if len(parts) >= 5:
                game_id = parts[3]
                sub_path = parts[4]
                
                lobby = None
                with lobbies_lock:
                    lobby = lobbies.get(game_id)
                if lobby:
                    with lobby.lock:
                        if sub_path == "start":
                            lobby.status = "playing"
                            lobby.game_state = body.get("gameState")
                            self.send_json({"success": True})
                        elif sub_path == "state":
                            lobby.game_state = body.get("gameState")
                            self.send_json({"success": True})
                        elif sub_path == "action":
                            lobby.actions.append(body.get("action"))
                            self.send_json({"success": True})
                        else:
                            self.send_error(404, "Endpoint not found")
                else:
                    self.send_json({"error": "Game not found"}, 404)
        else:
            self.send_error(404, "Endpoint not found")

def run(port=8000):
    server_address = ('', port)
    httpd = ThreadingHTTPServer(server_address, LANPlayRequestHandler)
    print(f"Harry Potter TCG LAN Server running on: http://localhost:{port}")
    print("Press Ctrl+C to stop.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server.")
        sys.exit(0)

if __name__ == '__main__':
    # Always change working directory to the directory of this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    init_decks_directory()
    
    # Default to port 8000, can override via command line
    port = 8000
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass
    run(port)
