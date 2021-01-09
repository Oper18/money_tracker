# coding: utf-8

import os
import uuid
import datetime
from itertools import chain
import psycopg2

from orator import DatabaseManager, Model
from orator.query.grammars import QueryGrammar
from orator.connections import PostgresConnection
from orator.connectors import connection_factory
from orator.query import QueryBuilder
from orator.support import Collection

from db_config import DATABASES

psycopg2.extras.register_uuid()

class MTQueryGrammar(QueryGrammar):

    marker = "%s"

    def _wrap_value(self, value):
        if value == "*":
            return value

        return '%s' % value.replace('"', '""')

    def compile_insert_get_id(self, query, values, sequence=None):
        if sequence is None:
            sequence = "id"

        return "%s RETURNING %s" % (
            self.compile_insert(query, values),
            self.wrap(sequence),
        )

    def wrap(self, value, prefix_alias=False):
        if self.is_expression(value):
            return self.get_value(value)

        if value.lower().find(" as ") >= 0:
            segments = value.split(" ")

            if len(segments) > 3:
                segments = [' '.join([i for i in segments[:-2]]), segments[-2], segments[-1]]

            if prefix_alias:
                segments[2] = self._table_prefix + segments[2]

            return "%s AS %s" % (self.wrap(segments[0]), self._wrap_value(segments[2]))

        wrapped = []

        segments = value.split(".")

        for key, segment in enumerate(segments):
            if key == 0 and len(segments) > 1:
                wrapped.append(self.wrap_table(segment))
            else:
                wrapped.append(self._wrap_value(segment))

        return ".".join(wrapped)


class MTQueryBuilder(QueryBuilder):
    def get_bindings(self):
        bindings = []
        for value in chain(*self._bindings.values()):
            if isinstance(value, datetime.date):
                value = value.strftime(self._grammar.get_date_format())
            elif isinstance(value, uuid.UUID):
                value = value.hex
            else:
                try:
                    value = uuid.UUID(value).hex
                except:
                    pass

            bindings.append(value)

        return bindings

    def get(self, columns=None):
        if not columns:
            columns = ["*"]

        original = self.columns

        if not original:
            self.columns = columns

        results = self._processor.process_select(self, self._run_select())
        for result in results:
            for content in result:
                if content and isinstance(content, list):
                    content = self.check_for_uuid(content)

        self.columns = original

        return Collection(results)

    def check_for_uuid(self, content):
        result = []
        for data in content:
            if isinstance(data, str):
                try:
                    data = uuid.UUID(data).hex
                except:
                    pass
            elif isinstance(data, dict):
                for d in data:
                    try:
                        data[d] = uuid.UUID(data[d]).hex
                    except:
                        pass
            elif isinstance(data, list):
                data = self.check_for_uuid(data)

            result.append(data)
        return result


class MTPostgresConnection(PostgresConnection):

    def __init__(
            self,
            connection,
            database="",
            table_prefix="",
            config=None,
            builder_class=MTQueryBuilder,
            builder_default_kwargs=None,
    ):
        super(MTPostgresConnection, self).__init__(connection, database, table_prefix, config, builder_class, builder_default_kwargs)

    def get_default_query_grammar(self):
        return MTQueryGrammar(marker=self._marker)


class MTConnectionFactory(connection_factory.ConnectionFactory):

    CONNECTIONS = {
        "postgres": MTPostgresConnection,
        "pgsql": MTPostgresConnection,
    }


class MTDatabaseManager(DatabaseManager):
    def __init__(self, config, factory=MTConnectionFactory()):
        super(MTDatabaseManager, self).__init__(config, factory)


Model.set_connection_resolver(MTDatabaseManager(DATABASES))
