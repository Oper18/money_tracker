# coding: utf-8

import sys
import uuid
import hashlib

from models import User
from settings import LOCAL_SALT

def create_user():
    salt = uuid.uuid4().hex
    password = hashlib.sha3_512(sys.argv[3].encode('utf-8') + salt.encode('utf-8') + LOCAL_SALT.encode('utf-8')).hexdigest()
    User.create(username=sys.argv[1],
                email=sys.argv[2],
                salt=salt,
                password=password,
                first_name=sys.argv[4],
                last_name=sys.argv[5])

if __name__ == '__main__':
    create_user()
