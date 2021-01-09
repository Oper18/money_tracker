FROM python:3.7

RUN mkdir /app
COPY requirements.txt /app/requirements.txt
WORKDIR /app
RUN apt-get update -y \
 && pip install --upgrade pip \
 && pip install -r requirements.txt

CMD gunicorn -b 0.0.0.0:5000 --access-logfile - --error-logfile - wsgi:app
