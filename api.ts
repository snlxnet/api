import qrcode from 'https://deno.land/x/qrcode_terminal/mod.js'
import { extractYaml, test } from "jsr:@std/front-matter"

const API_KEY = crypto.randomUUID()
logOk(`Generated a key: ${API_KEY}`)
qrcode.generate(API_KEY)
console.log("\t\t   You can scan it, why not")

await Deno.mkdir("persist").catch(() => logOk(`Persist directory exists`))

const statusSubscribers = new Set()
const currentStatus = {
  started: new Date(),
  action: "online",
}

Deno.serve({ port: 4242 }, handler)

function logOk(message: string) {
  const now = new Date()
  console.log(now.toISOString() + " %c" + message, "color: green")
}
function logErr(message: string) {
  const now = new Date()
  console.log(now.toISOString() + " %c" + message, "color: red")
}

function handler(request) {
  const url = new URL(request.url)
  const verb = request.method
  const endpoint = url.pathname
  const query = url.searchParams

  if (verb === "GET" && endpoint === "/") {
    return ui()
  } else if (verb === "GET" && endpoint === "/favicon.svg") {
    return svg("favicon.svg")
  } else if (verb === "GET" && endpoint === "/banner.svg") {
    return svg("banner.svg")
  } else if (verb === "GET" && endpoint === "/find") {
    return getOrFindFile(query)
  } else if (verb === "GET" && endpoint === "/file") {
    return getFile(query)
  } else if (verb === "POST" && endpoint === "/file") {
    return auth(query).then(() => postFile(query, request)).catch(deny)
  } else if (verb === "GET" && endpoint === "/upgrade") {
    return auth(query).then(upgradeServer).catch(deny)
  } else if (verb === "GET" && endpoint === "/status") {
    return getStatus(request)
  } else if (verb === "POST" && endpoint === "/status") {
    return auth(query).then(() => postStatus(query)).catch(deny)
  } else {
    return notFound()
  }

  function deny() {
    logErr(`Access denied to ${verb} ${endpoint} with query ${query.toString()}`)
    return new Response("ACCESS DENIED", { status: 403 })
  }
  function notFound() {
    logErr(`Not found ${verb} ${endpoint} with query ${query.toString()}`)
    return new Response("NOT FOUND", { status: 404 })
  }
}

async function auth(query) {
  if (query.get("pass") === API_KEY) {
    return Promise.resolve()
  } else {
    return Promise.reject()
  }
}

async function ui() {
  logOk("Returning the UI")

  const file = await Deno.open("./ui.html", { read: true });
  return new Response(file.readable, {
    headers: {
      "Content-Type": "text/html",
    },
  })
}

async function svg(path) {
  logOk("Returning the icon")

  const file = await Deno.open(path, { read: true });
  return new Response(file.readable, {
    headers: {
      "Content-Type": "image/svg+xml",
    },
  })
}

async function upgradeServer() {
  logOk("Upgrading the server...")

  const command = new Deno.Command("git", { args: ["pull"] });
  const { stdout, stderr } = await command.output();
  console.log(new TextDecoder().decode(stdout))
  console.error(new TextDecoder().decode(stderr))

  return new Response("done")
}

async function getFile(query) {
  const id = "./persist/" + query.get("id").replace("/", "-")
  try {
    const params = id.endsWith(".svg") ? { "Content-Type": "image/svg+xml" } : {}
    const file = await Deno.open(id, { read: true });
    logOk(`File sent ${id}`)
    return new Response(file.readable, params)
  } catch {
    logErr(`File not found ${id}`)
    return new Response("NOT FOUND", { status: 404 })
  }
}

async function getOrFindFile(query) {
  const id = "./persist/" + query.get("name").replace("/", "-")
  try {
    const parmas = id.endsWith(".svg") ? { "Content-Type": "image/svg+xml" } : {}
    const file = await Deno.open(id, { read: true });
    logOk(`File sent ${id}`)
    return new Response(file.readable, params)
  } catch {
    return findFile(query)
  }
}

async function findFile(query) {
  const requested = query.get("name").split("/").at(-1) + ".md"
  const allowedRoots = query.get("among").replace("/", ",").split(",")
  
  let allowedLinks = allowedRoots.map(async (rootNote) => {
    const text = await Deno.readTextFile("./persist/" + rootNote)
    const frontmatter = extractYaml(text)
    const rootName = frontmatter.attrs.name

		const leafNotes = text.matchAll(/\[.+?]\((.+?)\)/gm)
  		.map(([_match, captureGroup]) => captureGroup)
  		.filter(link => link.startsWith("/"))
  		.map(file => file.slice(1) + ".md")

    return [rootName, ...leafNotes]
  })
  allowedLinks = (await Promise.all(allowedLinks)).flat() 
  allowedLinks = [...new Set(allowedLinks)]

  let allowedFiles = []
  for await (let file of Deno.readDir("./persist")) {
    const id = file.name
    if (!file.isFile) continue;

    const text = Deno.readTextFileSync("./persist/" + file.name)
    if (!test(text)) continue;
    const frontmatter = extractYaml(text)
    const name = frontmatter.attrs.name
    if (allowedLinks.includes(id) || allowedLinks.includes(name)) {
      allowedFiles.push({ id, name })
    }
  }

  logOk(`Looking for ${requested} in ${JSON.stringify(allowedRoots)} & children`)
  const match = allowedFiles.find(file => file.name === requested)?.id

  if (!match) {
    logErr(`Find failed`)
    return new Response("NOT FOUND", { status: 404 })
  }

  logOk(`Found ${match}`)
  const file = await Deno.open("./persist/" + match, { read: true });
  return new Response(file.readable)
}

async function postFile(query, request) {
  const id = "./persist/" + query.get("id").replace("/", "-")
  const formData: FormData = await request.formData();
  const file = formData?.get("file") as File;

  if (!file) {
    logErr(`Upload error ${id}: attachment not found`)
    return new Response("UNKNOWN FORMAT", { status: 400 });
  }

  logOk(`Upload ok ${id}`)
  const buf = await file.stream()
  await Deno.writeFile(id, buf)
  return new Response("RECEIVED")
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
    statusSubscribers.add(socket)
    socket.send(JSON.stringify(currentStatus))
    logOk("Status sub")
  })
  socket.addEventListener("close", () => {
    statusSubscribers.delete(socket)
    logOk("Status unsub")
  })

  return response
}

function postStatus(query) {
  currentStatus.started = new Date()
  currentStatus.action = query.get("action")
  currentStatus.link = query.get("link")
  currentStatus.location = query.get("location")
  currentStatus.duration = query.get("duration")

  const status = JSON.stringify(currentStatus)
  statusSubscribers.forEach(socket => socket.send(status))
  logOk("Status sent")

  return new Response("UPDATED")
}
