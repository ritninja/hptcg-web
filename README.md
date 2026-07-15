# Harry Potter Trading Card Game - Local Web Edition

A local, web-based implementation of the classic Wizards of the Coast Harry Potter Trading Card Game. This application runs completely offline and locally on your computer, making it playable on macOS, Windows, or Linux.

---

## 🚀 How to Run the Game Locally

Modern web browsers block loading local JSON databases (`fetch`) and JavaScript modules (`import/export`) directly via the `file://` protocol due to **CORS (Cross-Origin Resource Sharing)** security measures. 

To run the game, launch a lightweight local web server in the game directory. Below are the easiest ways to do this across all operating systems:

### Option A: Running the local Python server (Required for Multiplayer & Deck Saving)
Open your terminal, navigate to the game directory, and run:
```bash
python3 server.py 8000
```
Then open your web browser and navigate to: **`http://localhost:8000`**

*(Note: The server defaults to port `8000`. You can change it by passing a custom port number, e.g. `python3 server.py 8080`)*

---

## 👥 How to Play Multiplayer (LAN) Matches

This game supports local area network (LAN) multiplayer, letting two players face off on the same Wi-Fi network. 

### 1. Prerequisites
- **Same Network:** Both players must be connected to the exact same Wi-Fi or local network (Ethernet).
- **Firewall Permissions:** The Host's computer must allow incoming connections on port `8000` (or whichever port the server is running on).

---

### 2. Step-by-Step Instructions

#### 🖥️ Host Setup
1. **Find your local IP address:**
   - **macOS:** Open Terminal and run: `ipconfig getifaddr en0` (or check system network details).
   - **Windows:** Open Command Prompt and run: `ipconfig` (find the `IPv4 Address`, usually looks like `192.168.X.Y`).
   - **Linux:** Open Terminal and run: `hostname -I`.
2. **Start the server:**
   - Open terminal, navigate to the game directory, and run:
     ```bash
     python3 server.py 8000
     ```
3. **Launch the game:**
   - Open your browser and go to `http://localhost:8000`.
   - Click **LAN Multiplayer** in the main menu.
4. **Create the lobby:**
   - Under **1. Your Profile**, enter your player name.
   - Leave the LAN Server Address blank (or use `http://localhost:8000`) and click **Connect**.
   - Under **2. Find or Host a Match**, click **Create New Match (Host)**.
   - Select your deck and wait for the Guest to connect in the waiting room.
   - Once the Guest joins, click **Enter the Match** to start!

---

#### 🧙 Guest Setup
1. **Get the Host's IP address:** Ask the host for their local network IP (e.g. `192.168.1.15`).
2. **Access the game:**
   - Open a browser on your machine and navigate to the Host's IP and port (e.g., `http://192.168.1.15:8000`).
   - Click **LAN Multiplayer** in the main menu.
3. **Connect to the server:**
   - Under **1. Your Profile**, enter your player name.
   - In the **LAN Server Address** field, enter the Host's address: `http://192.168.X.Y:8000` (substitute the Host's actual IP).
   - Click **Connect**.
4. **Join the match:**
   - Under **2. Find or Host a Match**, look at the **Open Lobbies on LAN** list.
   - Find the Host's lobby and click **Join**.
   - Select your deck and wait for the Host to start the match!

---

## 🌸 Credits & Acknowledgements
- **Card Images**: Special thanks to [accio.cards](https://accio.cards) for all the card artwork images.
- **Card Data**: Special thanks to the [Tressley/hpjson](https://github.com/Tressley/hpjson) repository for the card database info JSON files.


