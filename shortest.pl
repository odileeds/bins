#!/usr/bin/perl

$dest = "leeds";
if($ARGV[0] eq "north"){ $dest = "north"; }



open(NAMES,"$dest/names.csv");
@names = <NAMES>;
%abbr;

# We want to split things down into manageable chunks

foreach $line (@names){

	(@cols) = split(/,(?=(?:[^\"]*\"[^\"]*\")*(?![^\"]*\"))/,$line);
#	if($cols[1] == 31){
		$name = lc($cols[0]);
		$name =~ s/(^\"|\"$)//g;
		$name =~ s/[^A-Za-z0-9\s]//g;
		$a = "";
		if($cols[2] eq "p"){
#			# If it is a postcode we take the outcode
#			$name =~ /^([^\s]+)\s/;
#			$a = lc($1);
		}else{
			# Everything else we take the first three characters (minus spaces)
			$name =~ s/ //g;
			$a = lc(substr($name,0,3));
		}
		if($a){
			if(!$abbr{$a}){ $abbr{$a} = (); }
			$line =~ s/0+,/\,/g;
			push(@{$abbr{$a}},$line);
		}
#	}

}

# We want to remove roads with the same name that are close to each other
# as they are likely to be just bits of the same road.


# Sub divide
foreach $a (sort(keys(%abbr))){
	splitResults($a);
}

# Sub divide again
foreach $a (sort(keys(%abbr))){
	splitResults($a);
}

# Sub divide again
foreach $a (sort(keys(%abbr))){
	splitResults($a);
}

# Sub divide again
foreach $a (sort(keys(%abbr))){
	splitResults($a);
}

# Sub divide again
foreach $a (sort(keys(%abbr))){
	splitResults($a);
}


$dir = "db/";

if(!-d "$dest/$dir"){
	`mkdir $dest/$dir`;
}
open(AB,">","$dest/search.csv");
open(ABC,">","$dest/searchcompact.csv");
@lines = ();

foreach $a (sort(keys(%abbr))){
	$n = @{$abbr{$a}};
	# Only save if the key exists and we have results
	if($n > 0 && $a){
		if($n > 300){
			print "$a -> $n\n";
		}
		open(FILE,">","$dest/$dir$a.csv");
		for($i = 0; $i < $n; $i++){
			print FILE $abbr{$a}[$i];
		}
		close(FILE);
		$l = length($a);
		#if($lines[$l]){ $lines[$l] .= ","; }
		$lines[$l] .= $a;
		print AB "$a\n";
	}
}
for($i = 0; $i < @lines; $i++){
	print ABC $lines[$i]."\n";
}
close(AB);
close(ABC);


sub splitResults {
	my $key = $_[0];
	my ($n,$len,@cols,$i,$name,$newkey,$split);

	$split = 0;
	# The number of entries we have for this key
	#my @temp = @{$abbr{$key}};
	$n = @{$abbr{$key}};


	# If we have more than 200 results we'll split this
	if($n > 200){

		$split++;
		# Delete the old array
		#delete $abbr{$key};

		#print "Splitting $key ($n entries)...\n";
		$len = length($key);

		# We need to split the results further
		# Loop over every result with this key
		for($i = $n-1; $i >= 0; $i--){
			(@cols) = split(/,(?=(?:[^\"]*\"[^\"]*\")*(?![^\"]*\"))/,$abbr{$key}[$i]);
			# Get the name in lowercase
			$name = lc($cols[0]);
			# Remove quotes around it
			$name =~ s/(^\"|\"$)//g;
			# Remove non alpha-numeric-type characters to avoid problems
			# (they'll still be in the name just not in the filename for lookup)
			$name =~ s/[^A-Za-z0-9]//g;
			# Remove spaces
			$name =~ s/ //g;

			# The new key is one character longer than the existing one
			$a = lc(substr($name,0,$len+1));
#if($a =~ /^Ald/i || $key =~ /^ald/i){
#			print "\t$i = $key, $name, $a, $abbr{$key}[$i]\n";
#}
			if($a){
				# If the structure doesn't exist, create it
				if(!$abbr{$a}){ $abbr{$a} = (); }
				# Add this line
				push(@{$abbr{$a}},$abbr{$key}[$i]);
			}
			delete $abbr{$key}[$i];

#			print FILE $abbr{$a}[$i];
		}
		# Remove the old one
		#delete $abbr{$key};
	}
	return $split;
}
