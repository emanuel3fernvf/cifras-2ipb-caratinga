"""O navegador fornece pixels e geometria, nunca o texto da cifra."""
from __future__ import annotations

import base64
import io
import ipaddress
import shutil
import socket
import threading
import time
from urllib.parse import urlsplit

LOCK = threading.Lock()
ALPHABET = ''.join(chr(c) for c in range(33, 127)) + 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ°ºª–—♯♭'


def calibration_image(page):
    """Alfabeto conhecido desenhado pelo extrator, sem consultar conteúdo do site."""
    reference = page.evaluate_handle("""alphabet => {
        const el = document.createElement('pre');
        el.setAttribute('data-ocr-cifra', '');
        el.style.cssText = 'font:24px/32px "DejaVu Sans Mono", "Liberation Mono", monospace;'
          + 'padding:0;margin:0;border:0;width:max-content;white-space:pre;color:black;background:white';
        el.appendChild(document.createTextNode([...alphabet].map(c => '  ' + c + '  ').join('\\n')));
        document.body.appendChild(el); return el;
    }""", ALPHABET).as_element()
    try:
        return reference.screenshot(timeout=30000)
    finally:
        reference.evaluate('(el) => el.remove()')


def refine_pixels(image, calibration, rows, pitch, line_height, deadline=None):
    """OCR por comparação de glifos: corrige somente com evidência dos pixels."""
    from PIL import Image, ImageOps, ImageChops, ImageStat
    reference = Image.open(io.BytesIO(calibration)).convert('L')
    def mask(im):
        return ImageOps.invert(im.convert('L')).point(lambda p: 255 if p > 100 else 0)
    templates = []
    cell_width = round(pitch)
    for index, char in enumerate(ALPHABET):
        cell = reference.crop((round(2*pitch), index*line_height,
                               round(3*pitch), (index+1)*line_height))
        templates.append((char, mask(cell).resize((cell_width, int(line_height)))))
    binary = mask(image)
    cache = {}
    uncertain = False
    refined = {}
    for row in range((image.height + int(line_height)-1)//int(line_height)):
        if deadline is not None and time.monotonic() > deadline:
            raise ImportFailure("O OCR excedeu o tempo limite. Nenhum conteúdo foi substituído.", "ocr_timeout", 504)
        for col in range(int(image.width/pitch + .5)):
            cell = binary.crop((round(col*pitch), row*line_height,
                                round((col+1)*pitch), (row+1)*line_height))
            bounds = cell.getbbox()
            if not bounds or bounds[2] <= 2 or bounds[0] >= cell.width - 2:
                # Alguns glifos ultrapassam um pixel a célula vizinha.
                continue
            cell = cell.resize((cell_width, int(line_height)))
            key = cell.tobytes()
            if key not in cache:
                scores = []
                for char, template in templates:
                    # A fase subpixel varia uma fração de pixel entre colunas.
                    best = 1.0
                    template_bounds = template.getbbox()
                    dy = bounds[1] - template_bounds[1] if template_bounds else 0
                    # O site centraliza verticalmente alguns blocos de tablatura.
                    if abs(dy) > 8:
                        dy = 0
                    for dx in (-1, 0, 1):
                        shifted = ImageChops.offset(template, dx, dy)
                        union = ImageStat.Stat(ImageChops.lighter(cell, shifted)).sum[0]
                        score = ImageStat.Stat(ImageChops.difference(cell, shifted)).sum[0] / max(union, 1)
                        best = min(best, score)
                    if best < .5 and template_bounds:
                        # Compara também o desenho interno para não confundir | e ]
                        # quando a antisserrilha varia a espessura em um pixel.
                        shape = cell.crop(cell.getbbox()).resize((24, 48))
                        reference_shape = template.crop(template_bounds).resize((24, 48))
                        union = ImageStat.Stat(ImageChops.lighter(shape, reference_shape)).sum[0]
                        shape_error = ImageStat.Stat(ImageChops.difference(shape, reference_shape)).sum[0] / max(union, 1)
                        best = .5 * best + .5 * shape_error
                    scores.append((best, char))
                scores.sort()
                cache[key] = scores[0][1] if scores[0][0] < .3 and scores[1][0] - scores[0][0] > .06 else None
            char = cache[key]
            if char is None:
                uncertain = True
                char = rows.get(row, {}).get(col, '�')
            refined.setdefault(row, {})[col] = char
    return refined, uncertain


class ImportFailure(Exception):
    def __init__(self, message, code="import_failed", status=422):
        super().__init__(message)
        self.code, self.status = code, status


def validate_url(url):
    try:
        parsed = urlsplit(url)
        valid = (parsed.scheme == "https" and parsed.hostname in
                 {"cifraclub.com.br", "www.cifraclub.com.br"} and
                 parsed.port in (None, 443) and not parsed.username and not parsed.password)
    except (ValueError, TypeError):
        valid = False
    if not valid:
        raise ImportFailure("Informe um link HTTPS do Cifra Club.", "invalid_url", 400)
    return url


def public_host(host):
    try:
        addresses = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
        return bool(addresses) and all(ipaddress.ip_address(item[4][0]).is_global for item in addresses)
    except (OSError, ValueError):
        return False


def reconstruct(boxes, width, height, pitch, line_height, row_offset=0):
    """Posiciona caixas OCR numa grade global; coordenadas Tesseract partem de baixo."""
    rows = {}
    uncertain = False
    for record in boxes.splitlines():
        fields = record.split()
        if len(fields) != 6:
            continue
        char, left, bottom, right, top, _ = fields
        left, bottom, right, top = map(int, (left, bottom, right, top))
        col = int(((left + right) / 2) / pitch)
        row = int((height - (bottom + top) / 2) / line_height) + row_offset
        if col < 0 or row < row_offset or right > width:
            uncertain = True
            continue
        cells = rows.setdefault(row, {})
        if col in cells:
            uncertain = True
            # Não deslocar os próximos caracteres para acomodar colisões.
            cells[col] = "�"
        else:
            cells[col] = char
    return rows, uncertain


def recognize(png, pitch, line_height, calibration=None):
    from PIL import Image, ImageOps
    import pytesseract
    image = Image.open(io.BytesIO(png)).convert("RGB")
    rows, warnings = {}, []
    deadline = time.monotonic() + 180
    step = int(line_height * 4)
    for y in range(0, image.height, step):
        if time.monotonic() > deadline:
            raise ImportFailure("O OCR excedeu o tempo limite. Nenhum conteúdo foi substituído.", "ocr_timeout", 504)
        stripe = image.crop((0, y, image.width, min(y + step, image.height)))
        gray = ImageOps.grayscale(stripe)
        if gray.getextrema()[0] > 245:
            continue
        config = "--psm 6 -c preserve_interword_spaces=1"
        boxes = pytesseract.image_to_boxes(stripe, lang="por+eng", config=config, timeout=30)
        found, uncertain = reconstruct(boxes, stripe.width, stripe.height, pitch, line_height, int(y / line_height))
        rows.update(found)
        data = pytesseract.image_to_data(stripe, lang="por+eng", config=config,
                                         output_type=pytesseract.Output.DICT, timeout=30)
        if uncertain or any(float(c) < 80 for c, t in zip(data["conf"], data["text"]) if t.strip()):
            warnings.append("Há caracteres incertos; confira acordes e alinhamento no print.")
        if not found and calibration is None:
            raise ImportFailure("Uma faixa da imagem não pôde ser reconhecida. A cifra não foi importada.")
    if calibration is not None:
        rows, uncertain = refine_pixels(image, calibration, rows, pitch, line_height, deadline)
        if uncertain:
            warnings.append("Há caracteres sem correspondência visual segura; confira o print.")
    if not rows:
        raise ImportFailure("Nenhum texto foi reconhecido na imagem.")
    lines = []
    for row in range(max(rows) + 1):
        cells = rows.get(row, {})
        lines.append("".join(cells.get(col, " ") for col in range(max(cells, default=-1) + 1)))
    return "\n".join(lines), list(dict.fromkeys(warnings))


def capture(url):
    from playwright.sync_api import sync_playwright, TimeoutError as BrowserTimeout
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(args=["--disable-quic"])
            try:
                context = browser.new_context(viewport={"width": 1600, "height": 1000},
                                              device_scale_factor=2, service_workers="block")
                resolved_hosts = {}
                def route_request(route):
                    request = route.request
                    parsed = urlsplit(request.url)
                    if parsed.hostname not in resolved_hosts:
                        resolved_hosts[parsed.hostname] = public_host(parsed.hostname)
                    if parsed.scheme != "https" or not resolved_hosts[parsed.hostname]:
                        route.abort()
                        return
                    if request.is_navigation_request():
                        try:
                            validate_url(request.url)
                        except ImportFailure:
                            route.abort()
                            return
                    if request.resource_type in {"media", "image", "font"}:
                        route.abort()
                    else:
                        route.continue_()
                context.route("**/*", route_request)
                page = context.new_page()
                response = page.goto(url, wait_until="domcontentloaded", timeout=45000)
                validate_url(page.url)
                if response is None or response.status >= 400:
                    raise ImportFailure("O Cifra Club não permitiu carregar a página.")
                page.locator("pre").first.wait_for(state="attached", timeout=20000)
                target = page.locator(".cifra_cnt pre:visible, pre.cifra:visible")
                if target.count() == 0:
                    target = page.locator("pre:visible")
                if target.count() != 1:
                    raise ImportFailure("Não foi possível identificar uma única região de cifra.")
                # Move o próprio elemento: nenhuma serialização/leitura de conteúdo.
                geometry = target.evaluate("""el => {
                    document.body.appendChild(el);
                    const style = document.createElement('style');
                    style.textContent = `body > *:not([data-ocr-cifra]) { display:none !important; }
                    [data-ocr-cifra], [data-ocr-cifra] * {font-family:'DejaVu Sans Mono','Liberation Mono',monospace !important;
                    font-size:24px !important; font-weight:normal !important; font-style:normal !important;
                    line-height:32px !important; letter-spacing:0 !important; white-space:pre !important;
                    color:black !important; background:white !important; text-shadow:none !important;
                    content-visibility:visible !important; contain:none !important;}
                    [data-ocr-cifra] {display:block !important; position:static !important;
                    width:max-content !important; min-width:1px !important; max-width:none !important;
                    height:auto !important; max-height:none !important; overflow:visible !important;
                    padding:0 !important; margin:0 !important; border:0 !important; transform:none !important;}`;
                    el.setAttribute('data-ocr-cifra', ''); document.head.appendChild(style);
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d'); ctx.font = '24px "DejaVu Sans Mono", "Liberation Mono", monospace';
                    return {pitch:ctx.measureText('M').width * 2, lineHeight:64};
                }""")
                bounds = target.bounding_box()
                if (not bounds or bounds["width"] > 6000 or bounds["height"] > 30000
                        or bounds["width"] * bounds["height"] * 4 > 40_000_000):
                    raise ImportFailure("A região da cifra excede o tamanho suportado para captura completa.")
                png = target.screenshot(timeout=30000, animations="disabled")
                geometry["calibration"] = calibration_image(page)
                context.unroute_all(behavior="ignoreErrors")
                return png, geometry
            finally:
                browser.close()
    except BrowserTimeout as exc:
        raise ImportFailure("Tempo limite: página bloqueada ou região da cifra não encontrada.", "capture_timeout", 504) from exc


def import_cifra(url):
    validate_url(url)
    if not LOCK.acquire(blocking=False):
        raise ImportFailure("Já existe uma importação em andamento. Aguarde e tente novamente.", "busy", 409)
    try:
        try:
            import pytesseract
            from playwright.sync_api import sync_playwright  # noqa: F401
            if not shutil.which("tesseract"):
                raise ImportError("tesseract")
            if not {"por", "eng"}.issubset(pytesseract.get_languages()):
                raise ImportError("idiomas por e eng")
        except (ImportError, OSError) as exc:
            raise ImportFailure("Instale as dependências do extrator, Chromium e Tesseract (por e eng). Consulte extrator_cifraclub/README.md.", "missing_dependencies", 503) from exc
        png, geometry = capture(url)
        text, warnings = recognize(png, geometry["pitch"], geometry["lineHeight"], geometry["calibration"])
        return {"preText": text, "image": "data:image/png;base64," + base64.b64encode(png).decode("ascii"),
                "warnings": warnings, "message": "Confira o print antes de salvar; o OCR pode confundir caracteres."}
    except ImportFailure:
        raise
    except Exception as exc:
        raise ImportFailure("Falha na captura ou no OCR. Verifique a instalação do Chromium e Tesseract e tente novamente.") from exc
    finally:
        LOCK.release()
