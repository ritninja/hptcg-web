# Harry Potter Trading Card Game - Local Web Edition

A local, web-based implementation of the classic Wizards of the Coast Harry Potter Trading Card Game. This application runs completely offline and locally on your computer, making it playable on macOS, Windows, or Linux.

---

## 🚀 How to Run the Game Locally

Modern web browsers block loading local JSON databases (`fetch`) and JavaScript modules (`import/export`) directly via the `file://` protocol due to **CORS (Cross-Origin Resource Sharing)** security measures. 

To run the game, launch a lightweight local web server in the game directory. Below are the easiest ways to do this across all operating systems:

### Option A: Using Python (Mac & Linux - Pre-installed)
Open your terminal, navigate to the game directory, and run:
```bash
python3 server.py 8080
```
Then open your web browser and navigate to: **`http://localhost:8000`**


### Option B coming soon

---

## 🌸 Credits & Acknowledgements
- **Card Images**: Special thanks to [accio.cards](https://accio.cards) for all the card artwork images.
- **Card Data**: Special thanks to the [Tressley/hpjson](https://github.com/Tressley/hpjson) repository for the card database info JSON files.

