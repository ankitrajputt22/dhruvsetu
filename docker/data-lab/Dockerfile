# Analysis runtime for Polar Data Lab sessions.
# The backend starts one short-lived container from this image per session.
FROM python:3.12-slim

# The root filesystem is read-only at run time, so every writable path the
# kernel needs points into the session's temporary /tmp.
ENV PYTHONUNBUFFERED=1 \
    HOME=/tmp/home \
    IPYTHONDIR=/tmp/ipython \
    JUPYTER_RUNTIME_DIR=/tmp/jupyter \
    MPLCONFIGDIR=/tmp/matplotlib \
    XDG_CACHE_HOME=/tmp/cache

COPY requirements.txt /opt/lab/requirements.txt
RUN pip install --no-cache-dir -r /opt/lab/requirements.txt

RUN useradd --uid 1000 --no-create-home --shell /usr/sbin/nologin lab \
    && mkdir -p /workspace /data \
    && chown lab:lab /workspace

COPY lab_bridge.py /opt/lab/lab_bridge.py

USER lab
WORKDIR /workspace
ENTRYPOINT ["python", "/opt/lab/lab_bridge.py"]
