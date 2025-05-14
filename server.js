// server.js
const WebSocket = require("ws");
const fetch = require("node-fetch");
const http = require("http");

const server = http.createServer();
const wss = new WebSocket.Server({ server });

const KICK_WS_URL = "wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=8.4.0-rc2&flash=false";

wss.on("connection", async (client) => {
  console.log("🎮 Yeni Unreal istemcisi bağlandı");

  client.on("message", async (msg) => {
    const payload = JSON.parse(msg);
    if (!payload.username) return;

    console.log(`🔍 Yayıncı ismi alındı: ${payload.username}`);

    // Chatroom ID al
    const res = await fetch(`https://kick.com/api/v1/channels/${payload.username}`);
    if (!res.ok) return client.send(JSON.stringify({ error: "Kullanıcı bulunamadı" }));

    const data = await res.json();
    const chatroomId = data.chatroom?.id;
    if (!chatroomId) return client.send(JSON.stringify({ error: "Chatroom ID alınamadı" }));

    const channel = `chatrooms.${chatroomId}.v2`;
    const kickWS = new WebSocket(KICK_WS_URL);

    kickWS.on("open", () => {
      const subscribe = {
        event: "pusher:subscribe",
        data: { channel }
      };
      kickWS.send(JSON.stringify(subscribe));
      console.log(`📡 Kick kanalına abone olundu: ${channel}`);
    });

    kickWS.on("message", (event) => {
      const msg = JSON.parse(event);

      if (msg.event === "App\\Events\\ChatMessageEvent") {
        const msgData = JSON.parse(msg.data);
        client.send(JSON.stringify({
          type: "chat",
          username: msgData.sender?.username,
          color: msgData.sender?.identity?.color || "#fff",
          content: msgData.content,
          time: msgData.created_at
        }));
      }
    });

    kickWS.on("close", () => {
      console.log("📴 Kick bağlantısı kapandı.");
    });

    client.on("close", () => {
      console.log("🚪 Unreal istemcisi bağlantıyı kapattı.");
      kickWS.close();
    });
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log("✅ Sunucu çalışıyor!");
});
