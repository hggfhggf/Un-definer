const SITES = [
  ["codeforces", "Codeforces"],
  ["atcoder", "AtCoder"],
  ["qoj", "QOJ"],
  ["ojuz", "OJUZ"],
  ["codechef", "CodeChef"]
];

const defaults = Object.fromEntries(SITES.map(([key]) => [key, true]));
const list = document.querySelector("#site-list");

function render(settings) {
  list.textContent = "";

  SITES.forEach(([key, label]) => {
    const row = document.createElement("label");
    row.className = "site-row";

    const name = document.createElement("span");
    name.className = "site-name";
    name.textContent = label;

    const checkbox = document.createElement("input");
    checkbox.className = "switch";
    checkbox.type = "checkbox";
    checkbox.checked = settings[key] !== false;
    checkbox.addEventListener("change", () => {
      chrome.storage.local.set({
        enabledSites: {
          ...settings,
          [key]: checkbox.checked
        }
      });
    });

    row.append(name, checkbox);
    list.append(row);
  });
}

chrome.storage.local.get({ enabledSites: defaults }, ({ enabledSites }) => {
  render({ ...defaults, ...enabledSites });
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes.enabledSites) return;
  render({ ...defaults, ...changes.enabledSites.newValue });
});
