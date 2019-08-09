wget -O data/leeds/dm_premises.csv http://opendata.leeds.gov.uk/downloads/bins/dm_premises.csv
wget -O data/leeds/dm_jobs.csv http://opendata.leeds.gov.uk/downloads/bins/dm_jobs.csv

perl processBinData.pl
git add data/leeds/*.*
git commit -m "Update collection dates"
git push
