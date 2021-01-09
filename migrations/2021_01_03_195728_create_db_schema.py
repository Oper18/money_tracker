from orator.migrations import Migration


class CreateDbSchema(Migration):

    def up(self):
        """
        Run the migrations.
        """

        with self.schema.create('users') as table:
            table.increments('id')
            table.string('username', 128).unique()
            table.string('email', 128).nullable()
            table.string('salt', 255)
            table.string('password', 255)
            table.string('first_name', 64).default('')
            table.string('last_name', 64).default('')
            table.timestamps()

        with self.schema.create('purchases') as table:
            table.increments('id')
            table.string('name', 255)
            table.text('description').nullable()
            table.float('value')
            table.integer('currency')
            table.boolean('complete').default(False)
            table.integer('creator')
            table.integer('doer').default(False)
            table.timestamps()

        with self.schema.create('accumulations') as table:
            table.increments('id')
            table.string('name', 255)
            table.float('value')
            table.integer('currency')
            table.boolean('substract')
            table.integer('accumulation_type').nullable()
            table.timestamps()

        with self.schema.create('debts') as table:
            table.increments('id')
            table.string('name', 255)
            table.float('value')
            table.integer('currency')
            table.boolean('complete').default(False)
            table.integer('creator')
            table.date('end_date').nullable()
            table.timestamps()

        with self.schema.create('debt_payments') as table:
            table.increments('id')
            table.integer('user')
            table.float('value')
            table.timestamps()

        with self.schema.create('currencies') as table:
            table.increments('id')
            table.string('name', 64)
            table.timestamps()

        with self.schema.create('accumulation_types') as table:
            table.increments('id')
            table.string('name', 255)
            table.timestamps()

        with self.schema.create('loans') as table:
            table.increments('id')
            table.string('name', 255)
            table.float('value')
            table.integer('currency')
            table.boolean('closed').default(False)
            table.timestamps()


    def down(self):
        """
        Revert the migrations.
        """

        self.schema.drop('users')
        self.schema.drop('purchases')
        self.schema.drop('accumulations')
        self.schema.drop('debts')
        self.schema.drop('debt_payments')
        self.schema.drop('currencies')
        self.schema.drop('accumulation_types')
        self.schema.drop('loans')
