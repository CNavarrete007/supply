# Imagen oficial Python, indice multiarch fijado y verificado el 2026-10-20.
FROM python:3.12-slim-bookworm@sha256:34386ef0cb081344d7ec1c103ba398e6e9f64e9ab3a1509accc92a4e24a07258

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /work
COPY requirements.txt /work/requirements.txt
RUN python -m pip install --no-cache-dir --require-hashes --only-binary=:all: -r requirements.txt

# Este contexto contiene solo herramientas, DDL y fixtures sinteticos.
# El secreto y los reportes se montan en ejecucion desde fuera del proyecto.
COPY . /work
ENTRYPOINT ["python", "/work/db_tools.py"]
