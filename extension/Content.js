// This file is by far the most important of the whole extension.
// This gets loaded into every single page you open, so I have to keep it as light as possible.
// Sounds a bit a weird, for a file with 1200 lines, but I want it to so light that I need
// more rather than less code. No modules or anything fance like that

// @ts-ignore
const browser = /** @type {import("webextension-polyfill-ts").Browser} */ (
  globalThis.browser
);

let reformat = (line) => {
  if (line.startsWith("-")) {
    let without_dash = reformat(line.slice(1));
    if (without_dash == null) {
      return null;
    } else {
      return `-${without_dash}`;
    }
  }

  if (line.startsWith("♪ ") || line.endsWith(" ♪")) {
    return null;
  }
  if (line.startsWith("[") && line.endsWith("]")) {
    return null;
  }

  let m = null;
  if ((m = line.match(/^\[[^]+\] (.*)/))) {
    return m[1];
  }

  return line;
};

function nodes(element) {
  let result = [];
  for (let node of Array.from(element.childNodes)) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.tagName === "BR") {
        // result.push("NEWLINE");
      }
      let nested = nodes(node);
      result.push(...nested);
    } else if (node.nodeType === Node.TEXT_NODE) {
      result.push({ node: node, text: node.textContent });
    }
  }
  return result;
}

let is_observing = new WeakSet();

setInterval(() => {
  let subtitles_node = document.querySelector(".player-timedtext");

  if (subtitles_node == null) return;
  if (is_observing.has(subtitles_node)) return;

  is_observing.add(subtitles_node);

  console.log("START OBSERVING!");

  const observer = new MutationObserver((records) => {
    if (config.disabled) return;

    let n = nodes(subtitles_node);

    for (let node of n) {
      let text = reformat(node.text);
      console.log({ input: node.text, output: text });
      if (text == null) {
        node.node.nodeValue = "";
      } else {
        node.node.nodeValue = text;
      }
    }
    // for (let span of xs) {
    //   if (span.childElementCount !== 0) continue
    //   span.textContent = ""
    // }
  });

  observer.observe(subtitles_node, {
    childList: true,
    subtree: true,
  });
}, 500);

let config = {
  disabled: false,
};

try {
  /**
   * @param {{ type: string, [key: string]: any }} message
   */
  let send_chrome_message = async (message) => {
    let { type, value } = await browser.runtime.sendMessage(message);
    if (type === "resolve") {
      return value;
    } else {
      let err = new Error(value.message);
      err.stack = value.stack;
      // err.stack = [
      //   ...x.value.stack.split('\n'),
      //   'From postMessage to background page',
      //   ...stack,
      // ].join('\n');
      throw err;
    }
  };
  /**
   * @returns {Promise<{
   *  disabled: boolean,
   * }>}
   */
  let get_host_config_local = async () => {
    return await send_chrome_message({
      type: "get_windowed_config",
    });
  };
  let check_disabled_state = async () => {
    try {
      config = await get_host_config_local();
    } catch (err) {
      // prettier-ignore
      console.warn(`[Windowed] Error while checking if windowed is enabled or not`, err)
    }
  };

  check_disabled_state();

  browser.runtime.onConnect.addListener(async (port) => {
    port.postMessage({ type: "I_exists_ping" });
    check_disabled_state();
  });
} catch (error) {}
