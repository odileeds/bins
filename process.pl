#!/usr/bin/perl

use Geo::Coordinates::OSGB qw(ll_to_grid grid_to_ll);

$dest = "leeds";
if($ARGV[0] eq "north"){ $dest = "north"; }

$dir = "../../../../../projects/opname_csv_gb/DATA/";
if($dest eq "leeds"){
	@bounds = ([53.6953,-1.7923],[53.9431,-1.2868]);
}else{
	@bounds = ([52.9621,-3.6814],[55.8132,0.3892]);
}

opendir(my $dh, $dir);
@filenames = sort readdir( $dh );
closedir $dh;

%types;
%regions;
%places;
@names;

foreach $file (@filenames){
	$ok = 0;

	if($dest eq "north" && $file =~ /^(NU|NY|NZ|SD|SE|TA|SJ|SK)/){ $ok = 1; }
	if($dest eq "leeds" && $file =~ /^(SE)/){ $ok = 1; }
#	if($file =~ /^(SE)/){
#	if($file =~ /^(SK20)/){
	if($ok){
		print "$file\n";
		open(FILE,$dir.$file);
		@lines = <FILE>;
		close(FILE);

		foreach $line (@lines){
			(@cols) = split(/,(?=(?:[^\"]*\"[^\"]*\")*(?![^\"]*\"))/,$line);
			$t = "";
			$inbounds = 0;
			if($cols[7] eq "City"){ $t = "c"; }
			if($cols[7] eq "Hamlet"){ $t = "h"; }
			if($cols[7] eq "Village"){ $t = "v"; }
			if($cols[7] eq "Town"){ $t = "t"; }
			if($cols[7] eq "Named Road"){ $t = "r"; }
			if($cols[7] eq "Section Of Named Road"){ $t = "rs"; }
			if($cols[7] eq "Other Settlement"){ $t = "o"; }
			if($cols[7] eq "Postcode"){ $t = "p"; }
			if($cols[7] eq "Suburban Area"){ $t = "a"; }
			if($cols[7] eq "Numbered Road"){ $t = "n"; }
			if($cols[7] eq "Section Of Numbered Road"){ $t = "ns"; }
			if(!$types{$cols[7]}){ $types{$cols[7]} = 0; }

			# Get coordinates
			if($t eq "r" || $t eq "rs" || $cols[6] eq "populatedPlace"){
				($lat,$lon) = grid_to_ll($cols[8],$cols[9]);
				$lat += 0.0;
				$lon += 0.0;
				if($lat >= $bounds[0][0] && $lat <= $bounds[1][0] && $lon >= $bounds[0][1] && $lon <= $bounds[1][1]){
					$inbounds = 1;
				}
			}
			
			if($cols[6] eq "populatedPlace"){
				if($inbounds){
					if($places{$cols[2].",".$cols[21].",".$cols[16]}){
						print "Eek. Already have $cols[2],$cols[21],$cols[16].\n";
					}
					$places{$cols[2].",".$cols[21].",".$cols[16]} = "".sprintf("%0.4f",$lat).",".sprintf("%0.4f",$lon);
				}
			}

			if($t eq "r" || $t eq "rs"){
				$types{$cols[7]}++;
				# Set the local authority region
				$region = "";#$cols[24];
				# If the town column has a value, use that
				if($cols[21]){ $region = $cols[21]; }
				# If the village column has a value, use that
				if($cols[18]){ $region = $cols[18]; }

				if(!$regions{$region}){ $regions{$region} = 0; }
				$regions{$region}++;
				if($inbounds){
					push(@names,$cols[2].",$region,$cols[16],$t,".sprintf("%0.4f",$lat).",".sprintf("%0.4f",$lon));
				}
			}
		}
	}
}

%regionlookup;
$i = 0;

if(!-d $dest){
	`mkdir data/$dest`;
}


open(FILE,">","data/$dest/places.csv");
foreach $p (sort(keys(%places))){
	print FILE "$p,$places{$p}\n";
}
close(FILE);

open(FILE,">","data/$dest/areas.csv");
foreach $r (sort(keys(%regions))){
	$regionlookup{$r} = $i;
	print FILE "$i,$r\n";
	$i++;
}
close(FILE);
for($i = 0; $i < @names; $i++){
	(@cols) = split(/,(?=(?:[^\"]*\"[^\"]*\")*(?![^\"]*\"))/,$names[$i]);
	#$cols[1] = $regionlookup{$cols[1]};
	$names[$i] = "$cols[0],$cols[1],$cols[2],$cols[3],$cols[4],$cols[5]";
}

open(NAMES,">","data/$dest/names.csv");
@names = sort(@names);
foreach $line (@names){
	print NAMES $line."\n";
}
close(NAMES);

foreach $t (sort(keys(%types))){
	print "$t - $types{$t}\n";
}
print "\n\n";
foreach $r (sort(keys(%regions))){
	print "$r - $regions{$r}\n";
}
