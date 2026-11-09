# Herramienta efímera por socket Unix; el secreto no entra en el contexto.
FROM python:3.12-slim-bookworm@sha256:34386ef0cb081344d7ec1c103ba398e6e9f64e9ab3a1509accc92a4e24a07258
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /work
COPY requirements.txt /work/requirements.txt
RUN python -m pip install --no-cache-dir --require-hashes --only-binary=:all: -r requirements.txt
COPY bootstrap.py /work/bootstrap.py
ENTRYPOINT ["python", "/work/bootstrap.py"]
