import qrcode from "https://deno.land/x/qrcode_terminal/mod.js";

const API_KEY = crypto.randomUUID();
logOk(`Generated a key: ${API_KEY}`);
qrcode.generate(API_KEY);
console.log("\t\t   You can scan it, why not");

await Deno.mkdir("persist").catch(() => logOk(`Persist directory exists`));

const statusSubscribers = new Set();
const currentStatus = {
  started: new Date(),
  action: "online",
};

Deno.serve({ port: 4242 }, handler);

function logOk(message: string) {
  const now = new Date();
  console.log(now.toISOString() + " %c" + message, "color: green");
}
function logErr(message: string) {
  const now = new Date();
  console.log(now.toISOString() + " %c" + message, "color: red");
}

function handler(request) {
  const url = new URL(request.url);
  const verb = request.method;
  const endpoint = url.pathname;
  const query = url.searchParams;

  if (verb === "GET" && endpoint === "/") {
    return home({ request, url });
  } else if (verb === "GET" && endpoint === "/file") {
    return getFile(query);
  } else if (verb === "POST" && endpoint === "/file") {
    return auth(query).then(() => postFile(query, request)).catch(deny);
  } else if (verb === "GET" && endpoint === "/upgrade") {
    return auth(query).then(upgradeServer).catch(deny);
  } else if (verb === "GET" && endpoint === "/status") {
    return getStatus(request);
  } else if (verb === "POST" && endpoint === "/status") {
    return auth(query).then(() => postStatus(query)).catch(deny);
  } else {
    return notFound();
  }

  function deny() {
    logErr(
      `Access denied to ${verb} ${endpoint} with query ${query.toString()}`,
    );
    return new Response("ACCESS DENIED", { status: 403 });
  }
  function notFound() {
    logErr(`Not found ${verb} ${endpoint} with query ${query.toString()}`);
    return new Response("NOT FOUND", { status: 404 });
  }
}

async function auth(query) {
  if (query.get("pass") === API_KEY) {
    return Promise.resolve();
  } else {
    return Promise.reject();
  }
}

async function home({ request, url }) {
  logOk("Greeting someone, request info:");
  console.log(request, url);

  const command = new Deno.Command("uptime");
  const { stdout } = await command.output();
  const uptime = new TextDecoder().decode(stdout).split("users")[0].split(
    ",",
  )[0].trim();

  return new Response(`Hi! I store secret notes for the main site

Code: https://snlx.net/api-src
About: https://snlx.net/mk-api
Uptime: ${uptime}`);
}

async function svg(path) {
  logOk("Returning the icon");

  const file = await Deno.open(path, { read: true });
  return new Response(file.readable, {
    headers: {
      "Content-Type": "image/svg+xml",
    },
  });
}

async function upgradeServer() {
  logOk("Upgrading the server...");

  const command = new Deno.Command("git", { args: ["pull"] });
  const { stdout, stderr } = await command.output();
  console.log(new TextDecoder().decode(stdout));
  console.error(new TextDecoder().decode(stderr));

  return new Response("done");
}

async function getFile(query) {
  const id = "./persist/" + query.get("id").replace("/", "-");
  const keys = (query.get("keys") || "").replace("/", ",").split(",");

  if (id === "./persist/access.json") {
    return new Response("Nice try :)", { status: 403 });
  }

  const isImage = [".jpg", ".png", ".svg"].includes(id.slice(-4)) ||
    [".jpeg", ".webp"].includes(id.slice(-5));

  const access = JSON.parse(await Deno.readTextFile("./persist/access.json"));
  const accessible = Object.entries(access).filter(([k, _v]) =>
    keys.includes(k)
  ).flatMap(([_k, v]) => v).map((file) => "./persist/" + file);
  if (!accessible.includes(id) && !isImage) {
    logErr(`Rejected ${id} to ${keys}`);
    return new Response("Nope!", { status: 403 });
  }

  try {
    const params = id.endsWith(".svg")
      ? { headers: { "Content-Type": "image/svg+xml" } }
      : {};
    const file = await Deno.open(id, { read: true });
    logOk(`File sent ${id}`);
    return new Response(file.readable, params);
  } catch {
    logErr(`File not found ${id}`);
    return new Response("I don't have that file", { status: 404 });
  }
}

async function postFile(query, request) {
  const id = "./persist/" + query.get("id").replace("/", "-");
  const formData: FormData = await request.formData();
  const file = formData?.get("file") as File;

  if (!file) {
    logErr(`Upload error ${id}: attachment not found`);
    return new Response("UNKNOWN FORMAT", { status: 400 });
  }

  logOk(`Upload ok ${id}`);
  const buf = await file.stream();
  await Deno.writeFile(id, buf);
  return new Response("RECEIVED");
}

function getStatus(request) {
  if (request.headers.get("upgrade") !== "websocket") {
    return new Response(JSON.stringify(currentStatus), {
      headers: {
        "content-type": "application/json; charset=utf-8",
      },
    });
  }

  const { socket, response } = Deno.upgradeWebSocket(request);
  socket.addEventListener("open", () => {
    statusSubscribers.add(socket);
    socket.send(JSON.stringify(currentStatus));
    logOk("Status sub");
  });
  socket.addEventListener("close", () => {
    statusSubscribers.delete(socket);
    logOk("Status unsub");
  });

  return response;
}

function postStatus(query) {
  currentStatus.action = query.get("action");
  currentStatus.link = query.get("link");
  currentStatus.location = query.get("location");
  const newDuration = decodeURIComponent(query.get("duration") || "");
  if (newDuration !== "+pomo" || currentStatus.duration !== "+pomo") {
    currentStatus.started = new Date();
  }
  currentStatus.duration = newDuration;

  const status = JSON.stringify(currentStatus);
  statusSubscribers.forEach((socket) => socket.send(status));
  logOk("Status sent", query);

  return new Response("UPDATED");
}
