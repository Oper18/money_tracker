from orator.migrations import Migration


class AddDebtToComingInsTable(Migration):

    def up(self):
        """
        Run the migrations.
        """

        with self.schema.table('coming_ins') as table:
            table.integer('debt').nullable()

    def down(self):
        """
        Revert the migrations.
        """

        with self.schema.table('coming_ins') as table:
            table.drop_column('debt')
