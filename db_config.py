# coding: utf-8

import os

DATABASES = {
    'default': {
        'driver': 'postgres',
        'host': os.environ['DB_HOST'],
        'database': os.environ['DB_NAME'],
        'user': os.environ['DB_USER'],
        'password': os.environ['DB_PASSWORD'],
        'prefix': ''
    }
}
