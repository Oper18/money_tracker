from orator.migrations import Migration


class AddClosedFieldToAccumulationTable(Migration):

    def up(self):
        """
        Run the migrations.
        """

        with self.schema.table('accumulations') as table:
            table.boolean('closed').default(False)
            table.drop_column('substract')

    def down(self):
        """
        Revert the migrations.
        """

        with self.schema.table('accumulations') as table:
            table.drop_column('closed')
            table.boolean('substract').default(False)
