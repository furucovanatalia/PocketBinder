      const SUPABASE_URL = "https://luqecixzmqkohfyvytcs.supabase.co";
      const SUPABASE_KEY = "sb_publishable_VLmw0gOuAWJe56FjmJ_aIQ_8P__3Ftv";
      let sharedViewer = false,
        sharedCards = [];

      let albums = JSON.parse(localStorage.getItem("pb-albums") || "[]"),
        current = 0,
        pageNo = 1,
        color = "#17181d",
        layout = 3,
        binderStyle = "clean",
        db;
      let adjustSlot = null,
        adjustFile = null,
        adjustImage = null,
        adjustPoints = [],
        menuSlot = null,
        pickerSlot = null,
        longTimer = null,
        longTriggered = false,
        renderGeneration = 0,
        pendingAlbumCover = null,
        pendingCoverUrl = null,
        albumHoldTimer = null,
        albumHoldX = 0,
        albumHoldY = 0,
        albumHoldTriggered = false,
        editAlbumIndex = null,
        pendingEditCover = null,
        pendingEditCoverUrl = null,
        editAlbumColor = null;
      albums = albums.map((a, i) => ({
        ...a,
        id: a.id || "legacy-" + i,
        style: a.style || "clean",
        pages: a.pages || 1,
      }));
      save();
      function show(id) {
        document
          .querySelectorAll(".screen")
          .forEach((x) => x.classList.toggle("active", x.id === id));
        scrollTo(0, 0);
      }
      document.querySelectorAll(".color").forEach(
        (b) =>
          (b.onclick = () => {
            document
              .querySelectorAll(".color")
              .forEach((x) => x.classList.remove("selected"));
            b.classList.add("selected");
            color = b.dataset.color;
            preview.style.background = color;
            document
              .getElementById("realisticDemo")
              .style.setProperty("--demo-color", color);
          }),
      );
      document.querySelectorAll(".layout").forEach(
        (b) =>
          (b.onclick = () => {
            document
              .querySelectorAll(".layout")
              .forEach((x) => x.classList.remove("on"));
            b.classList.add("on");
            layout = +b.dataset.layout;
          }),
      );
      document.querySelectorAll(".style-choice").forEach(
        (b) =>
          (b.onclick = () => {
            document
              .querySelectorAll(".style-choice")
              .forEach((x) => x.classList.remove("on"));
            b.classList.add("on");
            binderStyle = b.dataset.style;
          }),
      );
      function save() {
        localStorage.setItem("pb-albums", JSON.stringify(albums));
      }
      async function createAlbum() {
        let album = {
          id: String(Date.now()),
          name: albumName.value.trim() || "My New Album",
          color,
          layout,
          style: binderStyle,
          pages: 1,
        };
        albums.push(album);
        save();
        if (pendingAlbumCover)
          await dbPut(`cover-${album.id}`, pendingAlbumCover);
        pendingAlbumCover = null;
        if (pendingCoverUrl) {
          URL.revokeObjectURL(pendingCoverUrl);
          pendingCoverUrl = null;
        }
        coverThumb.removeAttribute("src");
        coverThumb.style.display = "none";
        current = albums.length - 1;
        pageNo = 1;
        openBinder();
      }
      function pickAlbumCover() {
        albumCoverPicker.value = "";
        albumCoverPicker.click();
      }
      function albumCoverChosen(input) {
        let file = input.files && input.files[0];
        if (!file) return;
        pendingAlbumCover = file;
        if (pendingCoverUrl) URL.revokeObjectURL(pendingCoverUrl);
        pendingCoverUrl = URL.createObjectURL(file);
        coverThumb.src = pendingCoverUrl;
        coverThumb.style.display = "block";
      }
      async function renderAlbums() {
        if (!albums.length) {
          albumList.innerHTML =
            '<div class="empty">Your shelf is empty.<br>Create your first binder ✨</div>';
          return;
        }
        albumList.innerHTML =
          '<div class="albumsHint">Tap to open · Hold to edit</div><div class="albums">' +
          albums
            .map(
              (a, i) =>
                `<button class="card albumCard" oncontextmenu="return false" ondragstart="return false" onpointerdown="albumHoldStart(event,${i})" onpointerup="albumHoldEnd()" onpointercancel="albumHoldEnd()" onpointermove="albumHoldMove(event)" onclick="albumCardTap(${i})"><div class="book" id="albumBook${i}" style="background:${a.color}"></div><b>${a.name}</b><small>${a.pages} page${a.pages === 1 ? "" : "s"} · ${a.layout}×${a.layout}</small></button>`,
            )
            .join("") +
          "</div>";
        for (let i = 0; i < albums.length; i++) {
          let cover = await dbGet(`cover-${albums[i].id}`),
            book = document.getElementById(`albumBook${i}`);
          if (cover && book) {
            let url = URL.createObjectURL(cover);
            book.classList.add("has-cover");
            book.style.backgroundImage = `url("${url}")`;
          }
        }
      }
      function albumCardTap(i) {
        if (albumHoldTriggered) {
          albumHoldTriggered = false;
          return;
        }
        current = i;
        pageNo = 1;
        openBinder();
      }
      function albumHoldStart(e, i) {
        albumHoldX = e.clientX;
        albumHoldY = e.clientY;
        albumHoldTriggered = false;
        albumHoldTimer = setTimeout(() => {
          albumHoldTriggered = true;
          openAlbumEdit(i);
        }, 550);
      }
      function albumHoldEnd() {
        clearTimeout(albumHoldTimer);
      }
      function albumHoldMove(e) {
        if (Math.hypot(e.clientX - albumHoldX, e.clientY - albumHoldY) > 12)
          clearTimeout(albumHoldTimer);
      }
      async function openAlbumEdit(i) {
        editAlbumIndex = i;
        let a = albums[i];
        editAlbumName.value = a.name;
        editAlbumOwner.value = a.owner || "";
        editAlbumColor = a.color;
        document
          .querySelectorAll("#editColors .color")
          .forEach((b) =>
            b.classList.toggle("selected", b.dataset.color === editAlbumColor),
          );
        pendingEditCover = null;
        let cover = await dbGet(`cover-${a.id}`);
        if (pendingEditCoverUrl) {
          URL.revokeObjectURL(pendingEditCoverUrl);
          pendingEditCoverUrl = null;
        }
        if (cover) {
          pendingEditCoverUrl = URL.createObjectURL(cover);
          editCoverThumb.src = pendingEditCoverUrl;
          editCoverThumb.style.display = "block";
        } else {
          editCoverThumb.removeAttribute("src");
          editCoverThumb.style.display = "none";
        }
        editAlbumModal.classList.add("open");
      }
      function pickEditCover() {
        editCoverPicker.value = "";
        editCoverPicker.click();
      }
      function editCoverChosen(input) {
        let file = input.files && input.files[0];
        if (!file) return;
        pendingEditCover = file;
        if (pendingEditCoverUrl) URL.revokeObjectURL(pendingEditCoverUrl);
        pendingEditCoverUrl = URL.createObjectURL(file);
        editCoverThumb.src = pendingEditCoverUrl;
        editCoverThumb.style.display = "block";
      }
      document.querySelectorAll("#editColors .color").forEach(
        (b) =>
          (b.onclick = () => {
            document
              .querySelectorAll("#editColors .color")
              .forEach((x) => x.classList.remove("selected"));
            b.classList.add("selected");
            editAlbumColor = b.dataset.color;
          }),
      );
      async function saveAlbumEdit() {
        if (editAlbumIndex === null) return;
        let a = albums[editAlbumIndex];
        a.name = editAlbumName.value.trim() || "My Album";
        a.owner = editAlbumOwner.value.trim();
        a.color = editAlbumColor || a.color;
        save();
        if (pendingEditCover) await dbPut(`cover-${a.id}`, pendingEditCover);
        closeAlbumEdit();
        await renderAlbums();
      }
      function closeAlbumEdit() {
        editAlbumModal.classList.remove("open");
        if (pendingEditCoverUrl) {
          URL.revokeObjectURL(pendingEditCoverUrl);
          pendingEditCoverUrl = null;
        }
        pendingEditCover = null;
        editAlbumIndex = null;
      }
      function openBinder() {
        binderTitle.textContent = albums[current].name;
        ownerLine.style.display = "none";
        ownerLine.textContent = "";
        renderPage();
        show("binder");
      }
      function keyFor(i) {
        return `${albums[current].id}-${pageNo}-${i}`;
      }
      function rawKey(i) {
        return keyFor(i) + "-raw";
      }
      function pointsKey(i) {
        return keyFor(i) + "-points";
      }
      function openDB() {
        return new Promise((ok, no) => {
          let r = indexedDB.open("PocketBinderDB", 1);
          r.onupgradeneeded = () => {
            if (!r.result.objectStoreNames.contains("cards"))
              r.result.createObjectStore("cards");
          };
          r.onsuccess = () => {
            db = r.result;
            ok();
          };
          r.onerror = () => no(r.error);
        });
      }
      async function dbPut(k, v) {
        if (!db) await openDB();
        return new Promise((ok, no) => {
          let r = db
            .transaction("cards", "readwrite")
            .objectStore("cards")
            .put(v, k);
          r.onsuccess = () => ok();
          r.onerror = () => no(r.error);
        });
      }
      async function dbGet(k) {
        if (!db) await openDB();
        return new Promise((ok, no) => {
          let r = db.transaction("cards").objectStore("cards").get(k);
          r.onsuccess = () => ok(r.result);
          r.onerror = () => no(r.error);
        });
      }
      async function dbDelete(k) {
        if (!db) await openDB();
        return new Promise((ok, no) => {
          let r = db
            .transaction("cards", "readwrite")
            .objectStore("cards")
            .delete(k);
          r.onsuccess = () => ok();
          r.onerror = () => no(r.error);
        });
      }
      async function dbEntries() {
        if (!db) await openDB();
        return new Promise((ok, no) => {
          let s = db.transaction("cards").objectStore("cards"),
            r = s.openCursor(),
            out = [];
          r.onsuccess = () => {
            let c = r.result;
            if (c) {
              out.push([c.key, c.value]);
              c.continue();
            } else ok(out);
          };
          r.onerror = () => no(r.error);
        });
      }
      async function dbClear() {
        if (!db) await openDB();
        return new Promise((ok, no) => {
          let r = db
            .transaction("cards", "readwrite")
            .objectStore("cards")
            .clear();
          r.onsuccess = () => ok();
          r.onerror = () => no(r.error);
        });
      }

      function backupValueToJSON(v) {
        return new Promise((ok, no) => {
          if (v instanceof Blob) {
            let r = new FileReader();
            r.onload = () =>
              ok({
                __pbBlob: true,
                type: v.type || "application/octet-stream",
                data: r.result,
              });
            r.onerror = no;
            r.readAsDataURL(v);
          } else ok(v);
        });
      }
      async function backupJSONToValue(v) {
        if (!v || !v.__pbBlob) return v;
        let r = await fetch(v.data);
        return await r.blob();
      }
      async function exportBackup() {
        try {
          let entries = await dbEntries(),
            stored = [];
          for (let [key, value] of entries)
            stored.push([key, await backupValueToJSON(value)]);
          let backup = {
            format: "PocketBinder Backup",
            version: 1,
            createdAt: new Date().toISOString(),
            albums,
            storage: stored,
          };
          let blob = new Blob([JSON.stringify(backup)], {
              type: "application/json",
            }),
            url = URL.createObjectURL(blob),
            a = document.createElement("a");
          a.href = url;
          a.download = `PocketBinder-Backup-${new Date().toISOString().slice(0, 10)}.json`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1500);
        } catch (e) {
          console.error(e);
          alert("Could not create the backup. Please try again.");
        }
      }
      async function restoreBackup(input) {
        let file = input.files && input.files[0];
        input.value = "";
        if (!file) return;
        if (
          !confirm(
            "Restore this PocketBinder backup? This will replace the albums currently stored in this browser.",
          )
        )
          return;
        try {
          let data = JSON.parse(await file.text());
          if (
            !data ||
            data.format !== "PocketBinder Backup" ||
            !Array.isArray(data.albums) ||
            !Array.isArray(data.storage)
          )
            throw Error("Invalid backup");
          await dbClear();
          for (let [key, value] of data.storage)
            await dbPut(key, await backupJSONToValue(value));
          albums = data.albums;
          albums = albums.map((a, i) => ({
            ...a,
            id: a.id || "legacy-" + i,
            style: a.style || "clean",
            pages: a.pages || 1,
          }));
          save();
          current = 0;
          pageNo = 1;
          renderAlbums();
          show("albums");
          alert(
            `Backup restored 💜 ${albums.length} album${albums.length === 1 ? "" : "s"} loaded.`,
          );
        } catch (e) {
          console.error(e);
          alert(
            "This backup could not be restored. Please choose a valid PocketBinder backup file.",
          );
        }
      }
      function pageLayout(a = albums[current], p = pageNo) {
        return (a.pageLayouts && a.pageLayouts[p - 1]) || a.layout;
      }
      function renderPage(anim = "") {
        let generation = ++renderGeneration,
          a = albums[current],
          layout = pageLayout(a, pageNo);
        document.getElementById("pageLabel").textContent = "";
        pageCount.textContent = `${pageNo} / ${a.pages}`;
        prevNav.classList.toggle("hidden", pageNo === 1);
        nextNav.classList.toggle("hidden", pageNo === a.pages);
        pageWrap.className =
          "page-wrap " +
          ((a.style || "clean") === "realistic" ? "realistic" : "");
        pageWrap.style.setProperty("--binder-color", a.color);
        page.style.gridTemplateColumns = `repeat(${layout},1fr)`;
        page.className = "page " + anim;
        page.innerHTML = Array.from({ length: layout * layout }, (_, i) =>
          sharedViewer
            ? `<div class="pocket empty" data-slot="${i}"><span>＋</span></div>`
            : `<div class="pocket" data-slot="${i}"><span>＋</span><input type="file" accept="image/*" aria-label="Add card" onchange="directCardChosen(${i},this)"></div>`,
        ).join("");
        loadCards(generation);
      }
      async function pocketTap(i) {
        if (longTriggered) {
          longTriggered = false;
          return;
        }
        let existing = await dbGet(keyFor(i));
        if (existing) return;
        openCardPicker(i);
      }
      function openCardPicker(i) {
        pickerSlot = i;
        globalCardPicker.value = "";
        globalCardPicker.click();
      }
      function globalCardChosen(input) {
        let file = input.files && input.files[0];
        if (!file || pickerSlot === null) return;
        let i = pickerSlot;
        pickerSlot = null;
        startAdjust(i, file, null);
      }
      function directCardChosen(i, input) {
        let file = input.files && input.files[0];
        if (!file) return;
        input.value = "";
        startAdjust(i, file, null);
      }
      let holdX = 0,
        holdY = 0;
      function holdStart(e, i) {
        holdX = e.clientX;
        holdY = e.clientY;
        longTriggered = false;
        longTimer = setTimeout(async () => {
          if (await dbGet(keyFor(i))) {
            longTriggered = true;
            showCardMenu(i);
          }
        }, 550);
      }
      function holdEnd() {
        clearTimeout(longTimer);
      }
      function holdMove(e) {
        if (Math.hypot(e.clientX - holdX, e.clientY - holdY) > 12)
          clearTimeout(longTimer);
      }

      async function loadCard(i, generation, pageSnapshot, albumId) {
        let file = sharedViewer
          ? (Array.isArray(sharedCards[pageSnapshot - 1])
              ? sharedCards[pageSnapshot - 1][i]
              : sharedCards[
                  (pageSnapshot - 1) *
                    albums[current].layout *
                    albums[current].layout +
                    i
                ]) || null
          : await dbGet(`${albumId}-${pageSnapshot}-${i}`);
        if (
          generation !== renderGeneration ||
          pageNo !== pageSnapshot ||
          albums[current].id !== albumId ||
          !file
        )
          return;
        let pocket = page.querySelector(`[data-slot="${i}"]`);
        if (!pocket || generation !== renderGeneration) return;
        let url = sharedViewer ? file : URL.createObjectURL(file),
          img = new Image();
        img.onload = () => {
          if (
            generation !== renderGeneration ||
            pageNo !== pageSnapshot ||
            albums[current].id !== albumId
          ) {
            if (!sharedViewer) URL.revokeObjectURL(url);
            return;
          }
          pocket.classList.add("has-card");
          pocket.innerHTML = "";
          pocket.appendChild(img);
          img.alt = `Card ${i + 1}`;
          pocket.onpointerdown = (e) => {
            if (!sharedViewer) holdStart(e, i);
          };
          pocket.onpointerup = holdEnd;
          pocket.onpointercancel = holdEnd;
          pocket.onpointermove = holdMove;
          pocket.onclick = () => {
            if (longTriggered) {
              longTriggered = false;
              return;
            }
            openCardView(i);
          };
        };
        img.onerror = () => {
          if (!sharedViewer) URL.revokeObjectURL(url);
        };
        img.src = url;
      }
      async function loadCards(generation) {
        let pageSnapshot = pageNo,
          albumId = albums[current].id,
          total = pageLayout(albums[current], pageSnapshot) ** 2;
        await Promise.all(
          Array.from({ length: total }, (_, i) =>
            loadCard(i, generation, pageSnapshot, albumId),
          ),
        );
      }
      async function openCardView(i) {
        let file = sharedViewer
          ? (Array.isArray(sharedCards[pageNo - 1])
              ? sharedCards[pageNo - 1][i]
              : sharedCards[
                  (pageNo - 1) *
                    albums[current].layout *
                    albums[current].layout +
                    i
                ]) || null
          : await dbGet(keyFor(i));
        if (!file) return;
        let url = sharedViewer ? file : URL.createObjectURL(file);
        cardViewImg.onload = () => {
          if (!sharedViewer) URL.revokeObjectURL(url);
        };
        cardViewImg.src = url;
        cardView.classList.add("open");
      }
      function closeCardView(e) {
        if (e && e.target !== cardView) return;
        cardView.classList.remove("open");
        cardViewImg.removeAttribute("src");
      }
      function showCardMenu(i) {
        menuSlot = i;
        cardSheetBackdrop.classList.add("open");
      }
      function hideCardMenu() {
        cardSheetBackdrop.classList.remove("open");
      }
      function chooseMoveDestination() {
        let from = menuSlot;
        hideCardMenu();
        menuSlot = from;
        moveGrid.innerHTML = "";
        moveGrid.style.gridTemplateColumns = `repeat(${albums[current].layout},1fr)`;
        let total = albums[current].layout * albums[current].layout;
        for (let i = 0; i < total; i++) {
          let p = document.createElement("button");
          p.className = "pocket" + (i === from ? " current" : "");
          p.textContent = i + 1;
          p.disabled = i === from;
          dbGet(keyFor(i)).then((v) =>
            p.classList.add(v ? "occupied" : "empty"),
          );
          p.onclick = () => moveCardSafely(from, i);
          moveGrid.appendChild(p);
        }
        moveModal.classList.add("open");
      }
      function closeMoveModal() {
        moveModal.classList.remove("open");
        menuSlot = null;
      }
      async function moveCardSafely(from, to) {
        const suffixes = ["", "-raw", "-points"],
          pageSnapshot = pageNo,
          albumId = albums[current].id,
          base = (i) => `${albumId}-${pageSnapshot}-${i}`;
        let a = {},
          b = {};
        for (const s of suffixes) {
          a[s] = await dbGet(base(from) + s);
          b[s] = await dbGet(base(to) + s);
        }
        await new Promise((ok, no) => {
          let tx = db.transaction("cards", "readwrite"),
            store = tx.objectStore("cards");
          for (const s of suffixes) {
            let ak = base(from) + s,
              bk = base(to) + s;
            b[s] === undefined ? store.delete(ak) : store.put(b[s], ak);
            a[s] === undefined ? store.delete(bk) : store.put(a[s], bk);
          }
          tx.oncomplete = ok;
          tx.onerror = () => no(tx.error);
        });
        closeMoveModal();
        renderPage();
      }
      function closeCardMenu(e) {
        if (e.target === cardSheetBackdrop) hideCardMenu();
      }
      async function deleteCard() {
        let i = menuSlot;
        hideCardMenu();
        if (!confirm("Delete this card?")) return;
        await Promise.all([
          dbDelete(keyFor(i)),
          dbDelete(rawKey(i)),
          dbDelete(pointsKey(i)),
        ]);
        renderPage();
      }
      function replaceCard() {
        let i = menuSlot;
        hideCardMenu();
        openCardPicker(i);
      }
      async function adjustExisting() {
        let i = menuSlot;
        hideCardMenu();
        let raw = await dbGet(rawKey(i)),
          pts = await dbGet(pointsKey(i));
        if (!raw) {
          alert(
            "This card was added before v0.3.1. Choose Replace photo once, then corner adjustment will be available.",
          );
          return;
        }
        startAdjust(i, raw, pts);
      }
      function startAdjust(i, file, pts) {
        adjustSlot = i;
        adjustFile = file;
        let img = new Image(),
          url = URL.createObjectURL(file);
        img.onload = () => {
          adjustImage = img;
          openAdjust(pts);
          URL.revokeObjectURL(url);
        };
        img.src = url;
      }
      function openAdjust(saved) {
        adjustModal.classList.add("open");
        requestAnimationFrame(() => {
          let stage = adjustStage.getBoundingClientRect(),
            maxW = stage.width,
            maxH = stage.height,
            scale = Math.min(
              maxW / adjustImage.naturalWidth,
              maxH / adjustImage.naturalHeight,
            );
          adjustCanvas.width = Math.round(adjustImage.naturalWidth * scale);
          adjustCanvas.height = Math.round(adjustImage.naturalHeight * scale);
          adjustCanvas.style.width = adjustCanvas.width + "px";
          adjustCanvas.style.height = adjustCanvas.height + "px";
          adjustCanvas
            .getContext("2d")
            .drawImage(
              adjustImage,
              0,
              0,
              adjustCanvas.width,
              adjustCanvas.height,
            );
          adjustPoints = saved || [
            [0.08, 0.08],
            [0.92, 0.08],
            [0.92, 0.92],
            [0.08, 0.92],
          ];
          setupCorners();
        });
      }
      function canvasBox() {
        return adjustCanvas.getBoundingClientRect();
      }
      function setupCorners() {
        document.querySelectorAll(".corner").forEach((c, i) => {
          placeCorner(c, i);
          c.onpointerdown = (e) => dragCorner(e, c, i);
        });
        drawQuad();
      }
      function placeCorner(c, i) {
        let b = canvasBox(),
          s = adjustStage.getBoundingClientRect();
        c.style.left = b.left - s.left + adjustPoints[i][0] * b.width + "px";
        c.style.top = b.top - s.top + adjustPoints[i][1] * b.height + "px";
      }
      function drawMagnifier(i) {
        let p = adjustPoints[i],
          sx = p[0] * adjustImage.naturalWidth,
          sy = p[1] * adjustImage.naturalHeight,
          ctx = magnifierCanvas.getContext("2d"),
          crop = Math.max(
            45,
            Math.min(adjustImage.naturalWidth, adjustImage.naturalHeight) *
              0.08,
          );
        ctx.clearRect(0, 0, 224, 224);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          adjustImage,
          sx - crop / 2,
          sy - crop / 2,
          crop,
          crop,
          0,
          0,
          224,
          224,
        );
        let c = document.querySelector(`.corner[data-corner="${i}"]`),
          r = c.getBoundingClientRect(),
          s = adjustStage.getBoundingClientRect(),
          left = Math.max(
            0,
            Math.min(s.width - 112, r.left - s.left + r.width / 2 - 56),
          ),
          top = Math.max(4, r.top - s.top - 126);
        magnifier.style.left = left + "px";
        magnifier.style.top = top + "px";
        magnifier.classList.add("show");
      }
      function hideMagnifier() {
        magnifier.classList.remove("show");
      }
      function dragCorner(e, c, i) {
        e.preventDefault();
        c.setPointerCapture(e.pointerId);
        drawMagnifier(i);
        c.onpointermove = (ev) => {
          let b = canvasBox(),
            x = Math.max(0, Math.min(b.width, ev.clientX - b.left)),
            y = Math.max(0, Math.min(b.height, ev.clientY - b.top));
          adjustPoints[i] = [x / b.width, y / b.height];
          placeCorner(c, i);
          drawQuad();
          drawMagnifier(i);
        };
        c.onpointerup = () => {
          c.onpointermove = null;
          hideMagnifier();
        };
        c.onpointercancel = () => {
          c.onpointermove = null;
          hideMagnifier();
        };
      }
      function drawQuad() {
        quadLines.innerHTML = "";
        let b = canvasBox(),
          s = adjustStage.getBoundingClientRect();
        for (let i = 0; i < 4; i++) {
          let j = (i + 1) % 4,
            x1 = b.left - s.left + adjustPoints[i][0] * b.width,
            y1 = b.top - s.top + adjustPoints[i][1] * b.height,
            x2 = b.left - s.left + adjustPoints[j][0] * b.width,
            y2 = b.top - s.top + adjustPoints[j][1] * b.height,
            l = document.createElement("div"),
            d = Math.hypot(x2 - x1, y2 - y1);
          l.className = "quadLine";
          l.style.left = x1 + "px";
          l.style.top = y1 + "px";
          l.style.width = d + "px";
          l.style.transform = `rotate(${Math.atan2(y2 - y1, x2 - x1)}rad)`;
          quadLines.appendChild(l);
        }
      }
      function cancelAdjust() {
        adjustModal.classList.remove("open");
        adjustFile = null;
      }
      function solve8(A, b) {
        for (let i = 0; i < 8; i++) {
          let m = i;
          for (let r = i + 1; r < 8; r++)
            if (Math.abs(A[r][i]) > Math.abs(A[m][i])) m = r;
          [A[i], A[m]] = [A[m], A[i]];
          [b[i], b[m]] = [b[m], b[i]];
          let p = A[i][i];
          if (Math.abs(p) < 1e-10) throw Error("Invalid corners");
          for (let c = i; c < 8; c++) A[i][c] /= p;
          b[i] /= p;
          for (let r = 0; r < 8; r++)
            if (r !== i) {
              let f = A[r][i];
              for (let c = i; c < 8; c++) A[r][c] -= f * A[i][c];
              b[r] -= f * b[i];
            }
        }
        return b;
      }
      function homography(dst, src) {
        let A = [],
          b = [];
        for (let i = 0; i < 4; i++) {
          let [x, y] = dst[i],
            [u, v] = src[i];
          A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
          b.push(u);
          A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
          b.push(v);
        }
        let h = solve8(A, b);
        return [...h, 1];
      }
      async function saveAdjust() {
        let doneBtn = document.querySelector(".modalBtn.done");
        if (doneBtn.disabled) return;
        doneBtn.disabled = true;
        doneBtn.textContent = "Saving…";
        await new Promise((r) => setTimeout(r, 40));
        try {
          let W = 378,
            H = 528,
            src = adjustPoints.map((p) => [
              p[0] * adjustImage.naturalWidth,
              p[1] * adjustImage.naturalHeight,
            ]),
            dst = [
              [0, 0],
              [W - 1, 0],
              [W - 1, H - 1],
              [0, H - 1],
            ],
            h = homography(dst, src),
            source = document.createElement("canvas");
          source.width = adjustImage.naturalWidth;
          source.height = adjustImage.naturalHeight;
          source.getContext("2d").drawImage(adjustImage, 0, 0);
          let sd = source
              .getContext("2d")
              .getImageData(0, 0, source.width, source.height),
            out = document.createElement("canvas");
          out.width = W;
          out.height = H;
          let ctx = out.getContext("2d"),
            od = ctx.createImageData(W, H);
          for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++) {
              let z = h[6] * x + h[7] * y + 1,
                sx = (h[0] * x + h[1] * y + h[2]) / z,
                sy = (h[3] * x + h[4] * y + h[5]) / z,
                ix = Math.max(0, Math.min(source.width - 1, Math.round(sx))),
                iy = Math.max(0, Math.min(source.height - 1, Math.round(sy))),
                si = (iy * source.width + ix) * 4,
                di = (y * W + x) * 4;
              od.data[di] = sd.data[si];
              od.data[di + 1] = sd.data[si + 1];
              od.data[di + 2] = sd.data[si + 2];
              od.data[di + 3] = 255;
            }
          ctx.putImageData(od, 0, 0);
          let blob = await new Promise((ok) =>
            out.toBlob(ok, "image/jpeg", 0.9),
          );
          await dbPut(keyFor(adjustSlot), blob);
          await dbPut(rawKey(adjustSlot), adjustFile);
          await dbPut(pointsKey(adjustSlot), adjustPoints);
          adjustModal.classList.remove("open");
          renderPage();
        } catch (e) {
          console.error(e);
          alert("Could not save this card. Try moving the corners again.");
        } finally {
          doneBtn.disabled = false;
          doneBtn.textContent = "Done";
        }
      }
      function ensurePageLayouts(a) {
        if (!a.pageLayouts)
          a.pageLayouts = Array.from({ length: a.pages }, () => a.layout);
        while (a.pageLayouts.length < a.pages) a.pageLayouts.push(a.layout);
      }
      function addPage() {
        let a = albums[current],
          layout = pageLayout(a, pageNo);
        ensurePageLayouts(a);
        a.pages++;
        a.pageLayouts.push(layout);
        pageNo = a.pages;
        save();
        renderPage("slide-left");
      }
      function openLayoutModal() {
        layoutModal.classList.add("open");
      }
      function addPageWithLayout(layout) {
        let a = albums[current];
        ensurePageLayouts(a);
        a.pages++;
        a.pageLayouts.push(layout);
        pageNo = a.pages;
        save();
        layoutModal.classList.remove("open");
        renderPage("slide-left");
      }
      async function confirmDeletePage() {
        let a = albums[current];
        if (!a || sharedViewer) return;
        if (!confirm("Are you sure you want to delete this page?")) return;
        let deleted = pageNo,
          oldPages = a.pages;
        ensurePageLayouts(a);
        for (let p = deleted; p < oldPages; p++) {
          for (let i = 0; i < 16; i++) {
            let f = await dbGet(`${a.id}-${p + 1}-${i}`);
            if (f) await dbPut(`${a.id}-${p}-${i}`, f);
            else await dbDelete(`${a.id}-${p}-${i}`);
          }
        }
        for (let i = 0; i < 16; i++) await dbDelete(`${a.id}-${oldPages}-${i}`);
        a.pageLayouts.splice(deleted - 1, 1);
        if (a.pages > 1) a.pages--;
        else a.pageLayouts = [a.layout];
        if (pageNo > a.pages) pageNo = a.pages;
        save();
        renderGeneration++;
        page.innerHTML = "";
        await new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        );
        renderPage();
        let stableGeneration = renderGeneration;
        await loadCards(stableGeneration);
      }
      function nextPage() {
        if (pageNo < albums[current].pages) {
          pageNo++;
          renderPage("slide-left");
        } else bump("edge-left");
      }
      function prevPage() {
        if (pageNo > 1) {
          pageNo--;
          renderPage("slide-right");
        } else bump("edge-right");
      }
      function bump(c) {
        page.classList.remove("edge-left", "edge-right");
        void page.offsetWidth;
        page.classList.add(c);
      }

      function blobToDataURL(blob) {
        return new Promise((ok, no) => {
          let img = new Image(),
            u = URL.createObjectURL(blob);
          img.onload = () => {
            try {
              let max = 1000,
                scale = Math.min(
                  1,
                  max / Math.max(img.naturalWidth, img.naturalHeight),
                ),
                c = document.createElement("canvas");
              c.width = Math.round(img.naturalWidth * scale);
              c.height = Math.round(img.naturalHeight * scale);
              c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
              URL.revokeObjectURL(u);
              ok(c.toDataURL("image/jpeg", 0.72));
            } catch (e) {
              URL.revokeObjectURL(u);
              no(e);
            }
          };
          img.onerror = () => {
            URL.revokeObjectURL(u);
            no(new Error("Image compression failed"));
          };
          img.src = u;
        });
      }
      function makeShareId() {
        let a = new Uint8Array(18);
        crypto.getRandomValues(a);
        return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
      }
      async function shareCurrentAlbum() {
        shareModal.classList.add("open");
        shareStatus.textContent = "Creating a read-only snapshot…";
        shareLink.style.display = "none";
        copyShareBtn.style.display = "none";
        nativeShareBtn.style.display = "none";
        try {
          let a = albums[current],
            cards = [];
          ensurePageLayouts(a);
          for (let p = 1; p <= a.pages; p++) {
            let pageCards = [],
              layout = pageLayout(a, p);
            for (let i = 0; i < layout * layout; i++) {
              let f = await dbGet(`${a.id}-${p}-${i}`);
              pageCards.push(f ? await blobToDataURL(f) : null);
            }
            cards.push(pageCards);
          }
          let cover = await dbGet(`cover-${a.id}`),
            data = {
              version: 2,
              album: {
                name: a.name,
                owner: a.owner || "",
                color: a.color,
                layout: a.layout,
                pageLayouts: a.pageLayouts,
                style: a.style,
                pages: a.pages,
              },
              cover: cover ? await blobToDataURL(cover) : null,
              cards,
            },
            id = makeShareId(),
            res = await fetch(`${SUPABASE_URL}/rest/v1/shared_albums`, {
              method: "POST",
              headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
                "Content-Type": "application/json",
                Prefer: "return=minimal",
              },
              body: JSON.stringify({ id, album_data: data }),
            });
          if (!res.ok) throw Error(await res.text());
          shareLink.value = `${location.origin}${location.pathname}?share=${id}`;
          shareLink.style.display = "block";
          copyShareBtn.style.display = "block";
          if (navigator.share) nativeShareBtn.style.display = "block";
          shareStatus.innerHTML =
            "<b>Snapshot created 💜</b><br>This link shows your album exactly as it is now. Future changes won’t update this link.";
        } catch (e) {
          console.error(e);
          shareStatus.textContent =
            "DEBUG: " + (e && e.message ? e.message : String(e));
        }
      }
      async function nativeShareAlbum() {
        try {
          await navigator.share({
            title: albums[current]?.name || "PocketBinder Album",
            text: "Check out my PocketBinder album 💜",
            url: shareLink.value,
          });
        } catch (e) {
          if (e && e.name !== "AbortError") console.error(e);
        }
      }
      async function copyShareLink() {
        try {
          await navigator.clipboard.writeText(shareLink.value);
          copyShareBtn.textContent = "Copied ✓";
          setTimeout(() => (copyShareBtn.textContent = "Copy Link"), 1400);
        } catch (e) {
          shareLink.select();
          document.execCommand("copy");
        }
      }
      async function loadSharedAlbum(id) {
        try {
          let r = await fetch(
            `${SUPABASE_URL}/rest/v1/shared_albums?id=eq.${encodeURIComponent(id)}&select=album_data`,
            {
              headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
              },
            },
          );
          if (!r.ok) throw Error(await r.text());
          let rows = await r.json();
          if (!rows.length) throw Error("Not found");
          let d = rows[0].album_data,
            a = d.album;
          sharedViewer = true;
          sharedCards = d.cards || [];
          albums = [
            {
              id: "shared",
              name: a.name,
              owner: a.owner || "",
              color: a.color,
              layout: a.layout,
              pageLayouts: a.pageLayouts || null,
              style: a.style,
              pages: a.pages,
            },
          ];
          current = 0;
          pageNo = 1;
          document.body.classList.add("share-view");
          viewerBadge.style.display = "block";
          binderTitle.textContent = a.name;
          if (a.owner) {
            ownerLine.textContent = `${a.owner}’s PocketBinder 💜`;
            ownerLine.style.display = "block";
          } else {
            ownerLine.style.display = "none";
          }
          show("binder");
          renderPage();
        } catch (e) {
          console.error(e);
          albumList.innerHTML =
            '<div class="empty">This shared album could not be opened.</div>';
          show("albums");
        }
      }
      let touchX = 0,
        touchY = 0;
      pageWrap.addEventListener(
        "touchstart",
        (e) => {
          touchX = e.changedTouches[0].clientX;
          touchY = e.changedTouches[0].clientY;
        },
        { passive: true },
      );
      pageWrap.addEventListener(
        "touchend",
        (e) => {
          let dx = e.changedTouches[0].clientX - touchX,
            dy = e.changedTouches[0].clientY - touchY;
          if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.3)
            dx < 0 ? nextPage() : prevPage();
        },
        { passive: true },
      );
      openDB();
      let shareId = new URLSearchParams(location.search).get("share");
      if (shareId) loadSharedAlbum(shareId);