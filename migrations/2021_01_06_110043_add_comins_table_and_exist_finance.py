from orator.migrations import Migration


class AddCominsTableAndExistFinance(Migration):

    def up(self):
        """
        Run the migrations.
        """

        with self.schema.create('coming_ins') as table:
            table.increments('id')
            table.string('name', 255)
            table.text('description').nullable()
            table.float('value')
            table.integer('currency')
            table.integer('creator')
            table.timestamps()

        with self.schema.create('balance') as table:
            table.increments('id')
            table.float('value')
            table.integer('currency')
            table.timestamps()

    def down(self):
        """
        Revert the migrations.
        """

        self.schema.drop('coming_ins')
        self.schema.drop('balance')
