import { qs, show, api, PATHS } from "./api.js";

function switchTabs() {
  const hash = location.hash || "#login";

  const isLogin = hash === "#login";
  const isReg   = hash === "#register";

  show(qs("#page-login"), isLogin);
  show(qs("#page-register"), isReg);

  qs("#tab-login").classList.toggle("active", isLogin);
  qs("#tab-register").classList.toggle("active", isReg);
}

async function bootstrap() {
  try {
    await api(PATHS.me);
    window.location = "/";
  } catch {}
}

document.addEventListener("DOMContentLoaded", () => {
  bootstrap();
  switchTabs();
  window.addEventListener("hashchange", switchTabs);

  const loginMsg = qs("#login-msg");
  qs("#form-login").addEventListener("submit", async e=>{
    e.preventDefault(); show(loginMsg,false);
    try{
      const email = qs("#login-email").value;
      const password = qs("#login-password").value;
      await api(PATHS.login,"POST",{email,password});
      window.location = "/";
    }catch(err){
      loginMsg.textContent = "Error: "+err.message;
      loginMsg.className="msg err"; show(loginMsg,true);
    }
  });

  const regMsg = qs("#reg-msg");
  qs("#form-register").addEventListener("submit", async e=>{
    e.preventDefault(); show(regMsg,false);
    try{
      const email = qs("#reg-email").value;
      const username = qs("#reg-username").value;
      const password = qs("#reg-password").value;
      await api(PATHS.register,"POST",{email,username,password});
      regMsg.textContent="Success! now log in.";
      regMsg.className="msg ok"; show(regMsg,true);
    }catch(err){
      regMsg.textContent="Error: "+err.message;
      regMsg.className="msg err"; show(regMsg,true);
    }
  });
});
